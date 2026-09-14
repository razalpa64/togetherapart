import crypto from 'node:crypto';

export const now = () => Date.now();
export const id = (p = '') => p + crypto.randomBytes(9).toString('base64url');

export function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
export const ok = (res, obj) => json(res, 200, obj);
export const fail = (res, code, msg) => json(res, code, { error: msg });

export function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
export async function readJson(req, limit = 256 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); }
  catch { throw new Error('bad_json'); }
}

// --- tiny in-memory rate limiter (per key) ---
const buckets = new Map();
setInterval(() => {
  const t = now();
  for (const [k, b] of buckets) if (t - b.start > b.window) buckets.delete(k);
}, 60_000).unref();
export function rate(key, max, windowMs = 60_000) {
  const t = now();
  let b = buckets.get(key);
  if (!b || t - b.start > windowMs) { b = { start: t, window: windowMs, n: 0 }; buckets.set(key, b); }
  b.n++;
  return b.n <= max;
}

export const clean = (s, max = 200) => String(s ?? '').replace(/\u0000/g, '').trim().slice(0, max);
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export function daysUntil(ts) { return Math.ceil((ts - now()) / 86400000); }

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const pick = (arr) => arr[crypto.randomInt(arr.length)];
