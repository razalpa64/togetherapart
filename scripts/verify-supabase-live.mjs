#!/usr/bin/env node
// Live end-to-end verification against a REAL Supabase project.
// Signs up three throwaway users through the public API and exercises the
// app exactly as the frontend will: me_snapshot, create/join world, RLS
// isolation, chat insert, the surprise seal, game RPCs, storage policies.
// Cleans up every row it creates. Readable exit code for CI-ish use.
//
// Usage: node scripts/verify-supabase-live.mjs
// Env (or .env at project root): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*(SUPABASE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SECRET) { console.error('Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY (env or .env).'); process.exit(1); }

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } };

async function req(method, path, { key = ANON, token, body, raw, prefer } = {}) {
  const res = await fetch(URL_ + path, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...(raw ? { 'Content-Type': 'text/plain' } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body !== undefined ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const stamp = Date.now().toString(36);
const made = { users: [], coupleId: null, storagePath: null };

async function makeUser(email, name) {
  // Created through the Admin API: identical to a confirmed sign-up, but sends
  // no confirmation email — the built-in sender is rate-limited (~2/hour) and
  // public signups would 429 during tests.
  let r = await req('POST', '/auth/v1/admin/users', { key: SECRET, token: SECRET, body: { email, password: 'Live-Test-12345', email_confirm: true, user_metadata: { name } } });
  let userId = r.data?.id;
  if (!userId) { // already exists from an interrupted run — match client-side (the ?email= filter is NOT supported)
    const list = await req('GET', '/auth/v1/admin/users?per_page=1000', { key: SECRET, token: SECRET });
    const hit = (list.data?.users || []).find((u) => u.email === email);
    if (hit) {
      userId = hit.id;
      await req('PUT', `/auth/v1/admin/users/${userId}`, { key: SECRET, token: SECRET, body: { email_confirm: true } });
    }
  }
  if (!userId) return { error: 'could not create ' + email };
  made.users.push(userId);
  const login = await req('POST', '/auth/v1/token?grant_type=password', { body: { email, password: 'Live-Test-12345' } });
  return { userId, token: login.data?.access_token };
}

try {
  console.log('Live verification against', URL_);

  /* 1–2 · real sign-up + login */
  const A = await makeUser(`live-a-${stamp}@ta-test.local`, 'Live A');
  const B = await makeUser(`live-b-${stamp}@ta-test.local`, 'Live B');
  const C = await makeUser(`live-c-${stamp}@ta-test.local`, 'Outsider');
  ok('three users created + logged in (admin path)', !!(A.token && B.token && C.token && A.userId && B.userId && C.userId));

  /* 3 · me_snapshot before a world */
  let r = await req('POST', '/rest/v1/rpc/me_snapshot', { token: A.token });
  ok('me_snapshot works (no world yet)', r.data?.user?.id === A.userId && r.data?.couple === null);

  /* 4 · create world */
  r = await req('POST', '/rest/v1/rpc/create_world', { token: A.token, body: { p_your_name: 'Live A', p_partner_name: 'Live B' } });
  const couple = r.data;
  made.coupleId = couple?.id || null;
  ok('create_world returns a couple with invite code', !!couple?.id && !!couple?.invite_code && couple.name === 'Live A & Live B');

  /* 5 · A sees exactly their couple (RLS) */
  r = await req('GET', '/rest/v1/couples?select=id', { token: A.token });
  ok('A sees exactly 1 couple', r.data?.length === 1 && r.data[0].id === couple.id);

  /* 6 · B joins */
  r = await req('POST', '/rest/v1/rpc/join_world', { token: B.token, body: { p_code: couple.invite_code } });
  ok('B joins with the invite code', !!r.data?.id && r.data.id === couple.id);

  /* 7 · the outsider sees nothing (RLS isolation, live) */
  r = await req('GET', '/rest/v1/couples?select=id', { token: C.token });
  ok('outsider sees zero couples', r.data?.length === 0);
  r = await req('GET', `/rest/v1/messages?select=id&couple_id=eq.${couple.id}`, { token: C.token });
  ok('outsider cannot list the couple’s messages', Array.isArray(r.data) && r.data.length === 0);

  /* 8 · chat: A writes, B reads */
  r = await req('POST', '/rest/v1/messages', { token: A.token, prefer: 'return=representation', body: { couple_id: couple.id, sender: A.userId, type: 'text', body: 'hello from the live test' } });
  const msgId = Array.isArray(r.data) ? r.data[0]?.id : r.data?.id;
  ok('A inserts a message', !!msgId, JSON.stringify(r.data).slice(0, 120));
  r = await req('GET', `/rest/v1/messages?select=body&couple_id=eq.${couple.id}`, { token: B.token });
  ok('B reads A’s message', Array.isArray(r.data) && r.data.some((m) => m.body === 'hello from the live test'));
  r = await req('POST', '/rest/v1/messages', { token: C.token, body: { couple_id: couple.id, sender: C.userId, type: 'text', body: 'intruding' } });
  ok('outsider’s message insert rejected by RLS', r.status === 400 || r.status === 403);

  /* 9 · the surprise seal, live */
  r = await req('POST', '/rest/v1/surprises', { token: A.token, prefer: 'return=representation', body: { couple_id: couple.id, from_user: A.userId, to_user: B.userId, type: 'letter', payload: { title: 'sealed', body: 'you cannot see me yet' }, unlock_at: new Date(Date.now() + 86400000).toISOString() } });
  const surpriseId = Array.isArray(r.data) ? r.data[0]?.id : r.data?.id;
  ok('A leaves B a sealed surprise', !!surpriseId);
  r = await req('POST', '/rest/v1/rpc/list_surprises', { token: B.token });
  const sealed = Array.isArray(r.data) ? r.data.find((s) => s.id === surpriseId) : null;
  ok('B’s list shows no payload before unlock', sealed && sealed.payload === null && sealed.unlocked === false);
  r = await req('POST', '/rest/v1/rpc/open_surprise', { token: B.token, body: { p_id: surpriseId } });
  ok('B cannot open it early (423-style rejection)', /sealed/i.test(String(r.data?.message)), JSON.stringify(r.data).slice(0, 120));

  /* 10 · games, live */
  r = await req('POST', '/rest/v1/rpc/game_start', { token: A.token, body: { p_game: 'ttt', p_state: {} } });
  const session = r.data;
  ok('game_start (ttt)', session?.game === 'ttt' && Array.isArray(session?.state?.board));
  r = await req('POST', '/rest/v1/rpc/game_move', { token: A.token, body: { p_session: session.id, p_payload: { move: 4 } } });
  ok('A plays the centre', r.data?.state?.board?.[4] === A.userId);
  r = await req('POST', '/rest/v1/rpc/game_move', { token: B.token, body: { p_session: session.id, p_payload: { move: 4 } } });
  ok('B can’t play the taken cell', /hidden|taken|occupied/i.test(String(r.data?.message)) || r.data === null, JSON.stringify(r.data).slice(0, 100));
  r = await req('POST', '/rest/v1/rpc/game_move', { token: B.token, body: { p_session: session.id, p_payload: { move: 0 } } });
  ok('B plays a corner', r.data?.state?.board?.[0] === B.userId);
  r = await req('POST', `/rest/v1/game_sessions?select=id`, { token: C.token, method: 'GET' });
  const cGames = await req('GET', `/rest/v1/game_sessions?select=id&couple_id=eq.${couple.id}`, { token: C.token });
  ok('outsider sees zero game sessions', Array.isArray(cGames.data) && cGames.data.length === 0);

  /* 11 · storage policies, live */
  const path = couple.id ? `${couple.id}/live-test.txt` : 'skipped/live-test.txt';
  made.storagePath = path;
  r = await req('POST', `/storage/v1/object/media/${path}`, { token: A.token, body: 'hello bucket', raw: true });
  ok('A uploads into the couple’s folder', r.status === 200, JSON.stringify(r.data).slice(0, 100));
  r = await req('POST', `/storage/v1/object/media/${path}`, { token: C.token, body: 'intrude', raw: true });
  ok('outsider’s upload rejected', r.status >= 400);
  r = await req('POST', `/storage/v1/object/sign/media/${path}`, { token: A.token, body: { expiresIn: 120 } });
  const signed = r.data?.signedURL || r.data?.signedUrl;
  const dl = await fetch(URL_ + '/storage/v1' + String(signed).replace(/^\/storage\/v1/, ''));
  ok('signed URL round-trips the file', dl.status === 200 && (await dl.text()) === 'hello bucket');
} finally {
  /* 12 · cleanup everything this test made */
  try {
    if (made.storagePath) await req('DELETE', `/storage/v1/object/media/${made.storagePath}`, { key: SECRET, token: SECRET });
    if (made.coupleId) await req('DELETE', `/rest/v1/couples?id=eq.${made.coupleId}`, { key: SECRET, token: SECRET });
    for (const id of made.users) await req('DELETE', `/auth/v1/admin/users/${id}`, { key: SECRET, token: SECRET });
    console.log('  (test data cleaned up)');
  } catch (e) { console.log('  (cleanup warning: ' + e.message + ')'); }
}

console.log(`\n  ${pass} passed, ${fail} failed — live project verification`);
process.exit(fail ? 1 : 0);
