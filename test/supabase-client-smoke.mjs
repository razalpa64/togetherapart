globalThis.window = globalThis;
// The actual assertions — run via test/supabase-client-smoke.sh (which wires the mocks).
import { initSupabase, caps } from './facade.mjs';
import { getProvider, getResolver } from './mock-api.mjs';
import { getProvider as getWsProvider } from './mock-ws.mjs';
import { setBehavior, lastTraces } from './mock-supabase.mjs';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log('  ✗ ' + name); } };

await initSupabase({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' });
const api = getProvider();

ok('api provider installed', typeof api === 'function');
ok('realtime provider installed', typeof getWsProvider()?.connect === 'function');
ok('caps flagged (supabase + google)', caps.supabase === true && caps.google === true);
ok('caps published to window', globalThis.__TA_CAPS__ === caps);

/* --- pure client routes --- */
let d = await api('GET', '/api/decks/cards');
ok('decks route', d.deck.length > 0);
d = await api('POST', '/api/dates/plan', { minutes: 30, mood: 'chill', energy: 2 });
ok('date planner runs locally', d.plan.steps.length > 0 && d.plan.minutes === 30);

/* --- RPC passthrough --- */
setBehavior((tag) => {
  if (tag === '__rpc__:me_snapshot') return { user: { id: 'u1', member: { accent: 'rose' } }, couple: { room: {} }, partner: { mood: { mood: null, updatedAt: null } }, unread: 0, demo: {} };
  if (tag === '__rpc__:list_surprises') return [{ id: 'x', mine: true }];
  if (tag === '__rpc__:game_start') return { id: 'g1', game: 'ttt', state: { board: [null] }, status: 'active' };
  return { ok: true };
});
d = await api('GET', '/api/me');
ok('me via me_snapshot rpc', d.user.id === 'u1' && d.partner.mood === null);
d = await api('GET', '/api/surprises');
ok('surprises via list_surprises rpc', Array.isArray(d.surprises));
d = await api('POST', '/api/games/start', { game: 'ttt' });
ok('games via game_start rpc', d.session.id === 'g1' && d.session.game === 'ttt');

/* --- table wiring (traces) --- */
setBehavior(() => ({ data: null, error: null }));
lastTraces();
d = await api('PUT', '/api/mood', { mood: 'calm' });
const moodTrace = JSON.stringify(lastTraces());
ok('mood updates members filtered by user', d.mood === 'calm' && moodTrace.includes('members') && moodTrace.includes('u1'));

setBehavior((table, trace) => {
  if (trace[0]?.[0] === 'select') return { data: { room: { lamp: true, scene: 'living' } }, error: null }; // the read
  return { data: { room: { lamp: false, scene: 'living', volume: 0.9 } }, error: null };                    // the update
});
d = await api('PUT', '/api/room', { lamp: false, volume: 0.9 });
ok('room merges before update', d.room.lamp === false && d.room.scene === 'living');

setBehavior(() => ({ data: null, error: null }));
lastTraces();
d = await api('POST', '/api/notifications/read', { all: true });
ok('read-all marks unread only', d.ok === true && JSON.stringify(lastTraces()).includes('"is"'));

/* --- validation & errors --- */
const throws = async (fn, re, status) => {
  try { await fn(); return false; }
  catch (e) { return (!re || re.test(e.message)) && (!status || e.status === status); }
};
ok('empty message rejected', await throws(() => api('POST', '/api/messages', { type: 'text', body: '   ' }), /say something/i));
ok('message without media rejected', await throws(() => api('POST', '/api/messages', { type: 'image' }), /upload/i));
ok('past countdown rejected', await throws(() => api('POST', '/api/countdowns', { label: 'x', targetAt: Date.now() - 5000 }), /future/i));
ok('bad unlock time rejected', await throws(() => api('POST', '/api/surprises', { type: 'letter', unlockAt: 1 }), /unlock time/i));
ok('unknown route → 404', await throws(() => api('GET', '/api/nope'), null, 404));
ok('signup with unconfirmed email → friendly message', await throws(() => api('POST', '/api/auth/signup', { name: 'A', email: 'a@b.c', password: '12345678' }), /confirm your email/i));

/* --- media --- */
const url = await getResolver()('c1/abc.jpg');
ok('signed url from bucket', String(url).startsWith('https://signed/media/c1/abc.jpg'));
ok('demo media stays local', (await getResolver()('demo:hero-room')) === '/img/hero-room.jpg');
ok('missing media resolves null', (await getResolver()('')) === null);

/* --- realtime lifecycle against channel mock --- */
await getWsProvider().connect();
getWsProvider().send({ t: 'typing' });
getWsProvider().send({ t: 'presence', state: 'just_staying' });
getWsProvider().send({ t: 'song:sync', data: { kind: 'invite' } });
await getWsProvider().disconnect();
ok('realtime connect/send/disconnect', true);

console.log(`\n  ${pass} passed, ${fail} failed — supabase client backend smoke`);
process.exit(fail ? 1 : 0);
