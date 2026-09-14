// Together, Apart — server entrypoint.
// Zero-dependency Node 18+: static files, REST API, WebSocket realtime, WebRTC signaling.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './lib/db.js';
import { userForToken, tokenFromReq } from './lib/auth.js';
import { Realtime } from './lib/realtime.js';
import { makeEvents } from './lib/events.js';
import { handleApi } from './routes/index.js';
import { watchSurprises } from './routes/surprises.js';
import { seedDemo } from './content/demo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

load();
seedDemo();

const rt = new Realtime({ userForToken });
const events = makeEvents(rt);
watchSurprises(rt, events.notify);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p === '/app' || p === '/app/') p = '/app.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    // SPA-ish fallback: unknown non-api paths get the landing page
    const fallback = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
    fs.createReadStream(fallback).pipe(res);
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const cache = MIME[ext] === 'text/html; charset=utf-8' ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    try { await handleApi(req, res, url, rt, events); }
    catch (e) {
      console.error('[fatal]', e);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Something went wrong on our side.' })); }
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  serveStatic(req, res, url);
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  const user = userForToken(tokenFromReq(req, url));
  if (!user) { socket.destroy(); return; }
  rt.handleUpgrade(req, socket, user);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Together, Apart — your place, wherever you are`);
  console.log(`  serving  http://localhost:${PORT}  (ws: /ws)\n`);
});
