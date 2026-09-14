// Data layer — a small, durable JSON document store with atomic writes.
// The interface is intentionally thin so it can be swapped for Postgres/SQLite
// in production (see README "Going to production").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = path.join(ROOT, 'data');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
const FILE = path.join(DATA_DIR, 'app.json');

const TABLES = ['users','sessions','resets','couples','members','messages','reactions','reads',
  'memories','milestones','places','songs','countdowns','surprises','dates','games','media','notifications'];

const EMPTY = () => ({
  users: [], sessions: [], resets: [], couples: [], members: [], messages: [], reactions: [], reads: [],
  memories: [], milestones: [], places: [], songs: [], countdowns: [], surprises: [], dates: [], games: [],
  media: [], notifications: [],
  moods: {},        // userId -> {mood, updatedAt}
  notifPrefs: {},   // userId -> {category:bool}
  meta: { seededDemo: false },
});

let data = null;

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  if (fs.existsSync(FILE)) {
    try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
    catch { data = EMPTY(); } // corrupted file → start fresh rather than crash
  } else data = EMPTY();
  const blank = EMPTY();
  for (const t of TABLES) if (!Array.isArray(data[t])) data[t] = blank[t];
  for (const k of ['moods','notifPrefs','meta']) if (!data[k] || typeof data[k] !== 'object') data[k] = blank[k];
  return data;
}

export function db() { return data; }
export function save() {
  // Recreate the data dir if it vanished (e.g. a wipe while running) — never crash a write.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}
export const T = (name) => data[name];
export const one = (name, pred) => data[name].find(pred) || null;
export const many = (name, pred) => data[name].filter(pred);
export const remove = (name, pred) => { data[name] = data[name].filter(x => !pred(x)); };
export const byId = (name, id) => data[name].find(x => x.id === id) || null;
