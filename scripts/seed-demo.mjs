#!/usr/bin/env node
// Seeds the demo world (Aisha & Ravi) into a Supabase project.
// Uses the Admin API with the SERVICE ROLE key — keep that key secret and
// never put it in any frontend file.
//
// Usage:
//   node scripts/seed-demo.mjs --url https://YOURPROJECT.supabase.co --key YOUR_SERVICE_ROLE_KEY
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mjs
//   node scripts/seed-demo.mjs ... --force   # wipe the old demo world and reseed
//
// After seeding: the demo button signs in as aisha@demo.togetherapart.app /
// ravi@demo.togetherapart.app with the password below.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// convenience: load .env from the project root if present (no dependencies)
try {
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*(SUPABASE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : null;
};
const URL_ = arg('url') || process.env.SUPABASE_URL;
const KEY = arg('key') || process.env.SUPABASE_SERVICE_ROLE_KEY;
const FORCE = args.includes('--force');
const DEMO_PASSWORD = 'demo-world-123';
const DAY = 86400000, MIN = 60000;
const t0 = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const day = (n) => iso(t0 - n * DAY).slice(0, 10);

if (!URL_ || !KEY) {
  console.error('Need --url and --key (or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  console.error('Example: node scripts/seed-demo.mjs --url https://abcd.supabase.co --key eyJhbGciOi...');
  process.exit(1);
}
if (!/fetch/.test(typeof fetch)) { /* node 18+ has fetch */ }

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
async function api(method, path, body, extraHeaders = {}) {
  const res = await fetch(URL_ + path, {
    method,
    headers: { ...H, ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return data;
}
const log = (...a) => console.log('  ', ...a);

/* ---------- 1. find or create the demo users ---------- */
async function upsertUser(email, name) {
  const list = await api('GET', `/auth/v1/admin/users?per_page=1000`);
  const found = (list.users || []).find((u) => u.email === email);
  if (found) {
    await api('PUT', `/auth/v1/admin/users/${found.id}`, { user_metadata: { name }, email_confirm: true, ban_duration: 'none' });
    return { id: found.id, existed: true };
  }
  const created = await api('POST', '/auth/v1/admin/users', { email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { name } });
  return { id: created.id, existed: false };
}

/* ---------- 2. wipe an existing demo world if --force ---------- */
async function findDemoCouple() {
  const rows = await api('GET', '/rest/v1/couples?invite_code=eq.DEMO-0000&select=id');
  return rows && rows[0] ? rows[0].id : null;
}

async function main() {
  console.log('Seeding the demo world into', URL_);

  let cid = await findDemoCouple();
  if (cid && !FORCE) {
    console.log('\n  The demo world already exists (couple ' + cid + ').');
    console.log('  Run again with --force to delete and reseed it.');
    return;
  }
  if (cid && FORCE) {
    log('deleting old demo couple (cascades to its content)…');
    await api('DELETE', `/rest/v1/couples?id=eq.${cid}`, undefined, { Prefer: 'return=minimal' });
  }

  const aisha = await upsertUser('aisha@demo.togetherapart.app', 'Aisha');
  const ravi = await upsertUser('ravi@demo.togetherapart.app', 'Ravi');
  log(`aisha ${aisha.existed ? 'found' : 'created'} (${aisha.id})`);
  log(`ravi  ${ravi.existed ? 'found' : 'created'} (${ravi.id})`);

  // profiles are created by the handle_new_user trigger; make sure names are right
  await api('PATCH', `/rest/v1/profiles?id=eq.${aisha.id}`, { name: 'Aisha', tz: 'Asia/Kolkata' }, { Prefer: 'return=minimal' });
  await api('PATCH', `/rest/v1/profiles?id=eq.${ravi.id}`, { name: 'Ravi', tz: 'Asia/Kolkata' }, { Prefer: 'return=minimal' });

  /* ---------- 3. the couple + members ---------- */
  const [couple] = await api('POST', '/rest/v1/couples', [{
    name: 'Aisha & Ravi', invite_code: 'DEMO-0000', anniversary: '2026-02-14',
    theme: 'evening', plan: 'premium', demo: true, created_at: iso(t0 - 180 * DAY),
    room: { scene: 'living', window: 'dusk', lamp: true, stringLights: true, candle: true, tea: true, music: null, volume: 0.5 },
  }], { Prefer: 'return=representation' });
  cid = couple.id;
  log('couple created:', cid);

  await api('POST', '/rest/v1/members', [
    { couple_id: cid, user_id: aisha.id, display_name: 'Aisha', accent: 'rose', hair: 'long', joined_at: iso(t0 - 180 * DAY), mood: 'calm', mood_updated_at: iso(t0 - 40 * MIN) },
    { couple_id: cid, user_id: ravi.id, display_name: 'Ravi', accent: 'amber', hair: 'short', joined_at: iso(t0 - 179 * DAY), mood: 'good', mood_updated_at: iso(t0 - 90 * MIN) },
  ], { Prefer: 'return=minimal' });

  /* ---------- 4. demo photos → storage bucket ---------- */
  const photos = [
    ['hero-room.jpg', 'image/jpeg'], ['stay-rain.jpg', 'image/jpeg'], ['stay-beach.jpg', 'image/jpeg'],
    ['stay-balcony.jpg', 'image/jpeg'], ['stay-cabin.jpg', 'image/jpeg'], ['moment-watch.jpg', 'image/jpeg'],
  ];
  const mediaPath = {};
  for (const [file, type] of photos) {
    const buf = readFileSync(resolve(ROOT, 'public/img', file));
    const res = await fetch(`${URL_}/storage/v1/object/media/${cid}/${file}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': type, 'x-upsert': 'true' },
      body: buf,
    });
    if (!res.ok) throw new Error(`storage upload ${file} → ${res.status}: ${await res.text()}`);
    mediaPath[file] = `${cid}/${file}`;
  }
  log(photos.length, 'photos uploaded to the media bucket');

  /* ---------- 5. content ---------- */
  const msg = async (sender, body, minsAgo) =>
    api('POST', '/rest/v1/messages', [{ couple_id: cid, sender, type: 'text', body, created_at: iso(t0 - minsAgo * MIN) }], { Prefer: 'return=minimal' });
  await msg(ravi.id, 'landing in 40 mins, call after?', 2400);
  await msg(aisha.id, 'yes! i have so much to tell you today', 2398);
  await msg(ravi.id, 'oh no what happened 👀', 2397);
  await msg(aisha.id, 'nothing bad!! good things for once', 2395);
  await msg(ravi.id, 'those are my favorite kind', 2390);
  await msg(aisha.id, 'the cafe you sent me last week — i went today and sat there reading like it was our table', 1500);
  await msg(ravi.id, 'you did not', 1498);
  await msg(aisha.id, 'i did. two cups and everything ☕', 1497);
  await msg(ravi.id, 'next time i\'m in that chair across from you', 1490);
  await msg(aisha.id, '49 days 🕯️', 1488);
  await msg(ravi.id, '48. who\'s counting', 1486);
  await msg(aisha.id, 'sleep well, love. stay with me for a bit?', 120);
  await msg(ravi.id, 'always. rain on?', 118);
  log('13 messages');

  await api('POST', '/rest/v1/memories', [
    { couple_id: cid, author: ravi.id, type: 'milestone', title: 'First message', body: 'A reply to a story about train stations. The rest is history.', happened_on: day(213), media_path: null, song_title: null, song_artist: null, pinned: true, created_at: iso(t0 - 213 * DAY) },
    { couple_id: cid, author: aisha.id, type: 'milestone', title: 'First long call', body: 'Four hours. We said goodbye six times.', happened_on: day(205), media_path: null, song_title: null, song_artist: null, pinned: false, created_at: iso(t0 - 205 * DAY) },
    { couple_id: cid, author: ravi.id, type: 'milestone', title: 'We became official', body: 'You asked. I said yes before you finished the sentence.', happened_on: day(195), media_path: null, song_title: null, song_artist: null, pinned: false, created_at: iso(t0 - 195 * DAY) },
    { couple_id: cid, author: aisha.id, type: 'date', title: 'First virtual date', body: 'Rooftop date, 45 minutes, one candle each.', happened_on: day(149), media_path: mediaPath['stay-balcony.jpg'], song_title: null, song_artist: null, pinned: false, created_at: iso(t0 - 149 * DAY) },
    { couple_id: cid, author: aisha.id, type: 'photo', title: 'Our corner', body: 'The corner that feels like ours.', happened_on: day(96), media_path: mediaPath['hero-room.jpg'], song_title: null, song_artist: null, pinned: true, created_at: iso(t0 - 96 * DAY) },
    { couple_id: cid, author: ravi.id, type: 'song', title: 'Song of a rainy week', body: 'We played it on loop the whole monsoon.', happened_on: day(80), media_path: mediaPath['stay-rain.jpg'], song_title: 'Wherever You Will Go', song_artist: 'The Calling', pinned: false, created_at: iso(t0 - 80 * DAY) },
    { couple_id: cid, author: aisha.id, type: 'note', title: 'A tiny thing', body: 'You fell asleep mid-sentence on call and I stayed anyway.', happened_on: day(61), media_path: null, song_title: null, song_artist: null, pinned: false, created_at: iso(t0 - 61 * DAY) },
    { couple_id: cid, author: ravi.id, type: 'photo', title: 'Favorite memory', body: 'The sunset we watched on call, both of us silent.', happened_on: day(96), media_path: mediaPath['stay-beach.jpg'], song_title: null, song_artist: null, pinned: false, created_at: iso(t0 - 96 * DAY) },
  ], { Prefer: 'return=minimal' });
  log('8 memories');

  await api('POST', '/rest/v1/milestones', [
    { couple_id: cid, date: '2026-02-14', title: 'First message', note: 'A story about train stations', icon: '💬' },
    { couple_id: cid, date: '2026-02-22', title: 'First call', note: 'Four hours, six goodbyes', icon: '📞' },
    { couple_id: cid, date: '2026-03-03', title: 'We became official', note: 'You said yes before I finished asking', icon: '❤️' },
    { couple_id: cid, date: '2026-04-18', title: 'First virtual date', note: 'Rooftop, one candle each', icon: '🌙' },
    { couple_id: cid, date: '2026-05-25', title: 'First surprise', note: 'A letter that unlocked at sunrise', icon: '✉️' },
    { couple_id: cid, date: '2026-12-12', title: 'First real meeting', note: 'Airport arrivals, 11:40', icon: '✈️' },
  ], { Prefer: 'return=minimal' });
  log('6 milestones');

  await api('POST', '/rest/v1/places', [
    { couple_id: cid, name: 'Paris', country: 'France', status: 'dreaming', note: 'Someday.', dream_date: 'Rainy October, one umbrella, no plan.', target_on: null, checklist: [{ t: 'Stay in Montmartre', done: false }, { t: 'Eat falafel in the Marais', done: false }], created_at: iso(t0 - 120 * DAY) },
    { couple_id: cid, name: 'Kyoto', country: 'Japan', status: 'planned', note: 'The autumn trip. It\'s happening.', dream_date: 'Momiji season, 7 a.m. empty temples.', target_on: iso(t0 + 97 * DAY).slice(0, 10), checklist: [{ t: 'Book ryokan', done: true }, { t: 'Rail passes', done: true }, { t: 'Kaiseki night', done: false }], created_at: iso(t0 - 90 * DAY) },
    { couple_id: cid, name: 'Santorini', country: 'Greece', status: 'dreaming', note: 'For an anniversary, maybe.', dream_date: 'White walls, blue everything.', target_on: null, checklist: [], created_at: iso(t0 - 60 * DAY) },
  ], { Prefer: 'return=minimal' });
  log('3 places');

  await api('POST', '/rest/v1/songs', [
    { couple_id: cid, title: 'Wherever You Will Go', artist: 'The Calling', added_by: ravi.id, note: 'Our rainy-week song', favorite: true, month: true, position: 0, created_at: iso(t0 - 80 * DAY) },
    { couple_id: cid, title: 'Falling', artist: 'Jorja Smith', added_by: aisha.id, note: 'You hummed this on call once', favorite: false, month: false, position: 1, created_at: iso(t0 - 79 * DAY) },
    { couple_id: cid, title: 'Sunroof', artist: 'Nicky Youre', added_by: ravi.id, note: 'Morning-walk energy', favorite: false, month: false, position: 2, created_at: iso(t0 - 78 * DAY) },
    { couple_id: cid, title: 'La Vie En Rose', artist: 'Louis Armstrong', added_by: aisha.id, note: 'For Paris, eventually', favorite: true, month: false, position: 3, created_at: iso(t0 - 77 * DAY) },
    { couple_id: cid, title: 'Tum Se Hi', artist: 'Mohit Chauhan', added_by: ravi.id, note: 'The one from the wedding we crashed on video', favorite: false, month: false, position: 4, created_at: iso(t0 - 76 * DAY) },
    { couple_id: cid, title: 'Ocean Eyes', artist: 'Billie Eilish', added_by: aisha.id, note: '3 a.m. version of us', favorite: false, month: false, position: 5, created_at: iso(t0 - 75 * DAY) },
  ], { Prefer: 'return=minimal' });
  log('6 songs');

  await api('POST', '/rest/v1/countdowns', [
    { couple_id: cid, label: 'until we see each other', target_at: iso(t0 + 42 * DAY), icon: '✈️', created_by: ravi.id, created_at: iso(t0 - 10 * DAY) },
    { couple_id: cid, label: 'until our anniversary', target_at: iso(t0 + 152 * DAY), icon: '❤️', created_by: aisha.id, created_at: iso(t0 - 30 * DAY) },
  ], { Prefer: 'return=minimal' });
  log('2 countdowns');

  await api('POST', '/rest/v1/surprises', [
    { couple_id: cid, from_user: ravi.id, to_user: aisha.id, type: 'letter', payload: { title: 'For a hard week', body: 'I know this week was heavy. I can\'t be there in the morning, so this is me trying anyway. You carried so much — I saw it, even through a screen. Rest tonight. Everything you\'re worried about is smaller than it looks at 2 a.m. I\'m proud of you. — R' }, unlock_at: iso(t0 - 3 * DAY), opened_at: iso(t0 - 3 * DAY + 3600000), notified_at: iso(t0 - 3 * DAY), created_at: iso(t0 - 5 * DAY) },
    { couple_id: cid, from_user: aisha.id, to_user: ravi.id, type: 'gift', payload: { title: 'A small thing', gift: '🎧', note: 'For the nights you can\'t sleep. One song, eyes closed, think of the cafe.' }, unlock_at: iso(t0 + 2 * DAY), opened_at: null, notified_at: null, created_at: iso(t0 - 1 * DAY) },
  ], { Prefer: 'return=minimal' });
  log('2 surprises (one opened letter, one still sealed)');

  await api('POST', '/rest/v1/dates', [{
    couple_id: cid, mood: 'romantic', duration: 45, status: 'done', current_step: 6,
    started_at: iso(t0 - 149 * DAY), ended_at: iso(t0 - 149 * DAY + 50 * MIN), created_by: ravi.id, created_at: iso(t0 - 149 * DAY),
    plan: {
      title: 'ROOFTOP DATE', mood: 'romantic', energy: 2, minutes: 45, env: 'balcony',
      steps: [
        { kind: 'arrive', icon: '🚪', title: 'Arrive at the rooftop', desc: 'Blankets on, city lights on.', minutes: 3, startMin: 0, time: '00 min' },
        { kind: 'song', icon: '🎵', title: 'Choose a song for each other', desc: 'No explaining. Just send it.', minutes: 10, startMin: 3, time: '03 min' },
        { kind: 'cards', icon: '💬', title: 'Conversation cards', deck: 'cards', count: 4, desc: 'Take turns. Follow the tangents.', minutes: 15, startMin: 13, time: '13 min' },
        { kind: 'photo', icon: '📷', title: 'Take a couple photo', desc: 'Three seconds, no redoing it.', minutes: 6, startMin: 28, time: '28 min' },
        { kind: 'sunset', icon: '🌇', title: 'Watch the sky', desc: 'Until the color goes.', minutes: 7, startMin: 34, time: '34 min' },
        { kind: 'gratitude', icon: '❤️', title: 'End with a gratitude message', desc: 'One thing. Say it, then write it.', minutes: 4, startMin: 41, time: '41 min' },
      ],
    },
  }], { Prefer: 'return=minimal' });
  log('1 finished date night');

  console.log('\n  Demo world seeded. ✨');
  console.log('  Sign in on the app with the demo button, or directly:');
  console.log('    aisha@demo.togetherapart.app / ' + DEMO_PASSWORD);
  console.log('    ravi@demo.togetherapart.app  / ' + DEMO_PASSWORD);
}

main().catch((e) => { console.error('\n  Seeding failed:', e.message); process.exit(1); });
