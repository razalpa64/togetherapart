#!/usr/bin/env node
// Serves the frontend (public/) for Supabase mode — no Node app server needed.
//   /           → index.html (the landing page)
//   /app        → app.html   (the app; env.js points it at Supabase)
//   /app?code=… → app.html   (OAuth / recovery redirects land here)
//   everything else straight from public/
//
// Usage: node scripts/serve-static.mjs [port]     (default 4020, binds 0.0.0.0)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.argv[2] || process.env.PORT || 4020);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    if (path === '/app' || path.startsWith('/app/')) { path = '/app.html'; }         // the app shell
    else if (path === '/') { path = '/index.html'; }
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('no'); return; }
    await stat(file).catch(() => { throw Object.assign(new Error('nf'), { code: 'ENOENT' }); });
    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.startsWith('/vendor/') || path.startsWith('/img/') ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

function dirname(p) { return p.split('/').slice(0, -1).join('/') || '/'; }

server.listen(PORT, '0.0.0.0', () => {
  console.log('Together, Apart (static frontend for Supabase mode)');
  console.log('  http://localhost:' + PORT + '/app');
  console.log('  Make sure public/env.js points at your Supabase project.');
});
