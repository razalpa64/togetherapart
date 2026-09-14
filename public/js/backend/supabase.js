// Supabase backend — a drop-in provider for api.js + ws.js.
// When window.__TA_ENV__ carries a supabaseUrl + anon key, app.js boots this
// module instead of talking to the self-hosted Node server. Every REST route
// the frontend knows is served here from Postgres via supabase-js, with
// realtime channels standing in for the WebSocket.
//
//   api.js  →  apiRoute(method, path, body)      (same routes, same shapes)
//   ws.js   →  connectRealtime / sendShim        (bus events: ws:*)
//   media   →  signed URLs from the 'media' storage bucket
import { createClient } from '/vendor/supabase.js';
import { emit } from '../bus.js';
import { setApiProvider, setMediaResolver, setToken, clearToken, getToken, ApiError } from '../api.js';
import { setRealtimeProvider } from '../ws.js';
import { store } from '../state.js';
import { decks } from '../content/decks.js';
import { planDate } from '../content/planner.js';

export const caps = { supabase: false, google: false };

let sb = null;
let channel = null;
let myUserId = null;
let myMeta = { state: 'online', tz: null, lastSeen: 0 };
let unlockTimer = null;
const urlCache = new Map(); // media id → { url, exp }
const dateCache = new Map(); // date id → { status, currentStep } (for event typing)
let myDateAction = null;    // { id, type, at } — remembers which date action THIS tab just performed

const DEMO_PASSWORD = 'demo-world-123';
const DEMO_USERS = { aisha: 'aisha@demo.togetherapart.app', ravi: 'ravi@demo.togetherapart.app' };
const DEMO_IMG = {
  'demo:hero-room': 'hero-room.jpg', 'demo:moment-watch': 'moment-watch.jpg', 'demo:moment-game': 'moment-game.jpg',
  'demo:moment-memories': 'moment-memories.jpg', 'demo:moment-dinner': 'moment-dinner.jpg', 'demo:surprise-letter': 'surprise-letter.jpg',
  'demo:stay-rain': 'stay-rain.jpg', 'demo:stay-balcony': 'stay-balcony.jpg', 'demo:stay-beach': 'stay-beach.jpg', 'demo:stay-cabin': 'stay-cabin.jpg',
  'demo:stay-rooftop': 'hero-room.jpg',
};

/* ---------------- helpers ---------------- */
const ms = (v) => (v ? new Date(v).getTime() : null);
const clean = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);
const fail = (msg, status = 400) => new ApiError(msg, status);
const needCouple = () => {
  const cid = store.me?.couple?.id;
  if (!cid) throw fail('Create your world first.', 409);
  return cid;
};
const needPartner = () => {
  const p = store.me?.partner;
  if (!p) throw fail('You\'ll need your partner in the world first.', 409);
  return p;
};
const meId = () => {
  const id = store.me?.user?.id;
  if (!id) throw fail('We lost your session. Refresh and try again.', 401);
  return id;
};
function wrapPgError(e, fallback) {
  const msg = String(e?.message || '');
  if (/row-level security|permission denied/i.test(msg)) return fail('That didn\'t go through — try refreshing.', 403);
  if (/duplicate key/i.test(msg)) return fail('That already exists.', 409);
  if (/JWT|token/i.test(msg)) return fail('We lost your session. Refresh and sign in again.', 401);
  return fail(msg || fallback || 'Something didn\'t work. Try again?', 400);
}
async function rpc(name, args = {}) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw wrapPgError(error);
  return data;
}
const isDemoId = (s) => typeof s === 'string' && s.startsWith('demo:');

/* ---------------- row mappers (snake_case → the app's camelCase) ---------------- */
const mapCouple = (c, members = 2) => c && ({
  id: c.id, name: c.name, inviteCode: c.invite_code, anniversary: c.anniversary || null,
  theme: c.theme, plan: c.plan, room: c.room || {}, demo: !!c.demo, createdAt: ms(c.created_at), members,
});
async function membersCount(cid) {
  const { count } = await sb.from('members').select('*', { count: 'exact', head: true }).eq('couple_id', cid);
  return count || 1;
}
const mapMemory = (m) => ({
  id: m.id, type: m.type, title: m.title, body: m.body, media: m.media_path || null,
  happenedOn: m.happened_on, songTitle: m.song_title || null, songArtist: m.song_artist || null,
  pinned: !!m.pinned, createdAt: ms(m.created_at),
});
const mapMilestone = (m) => ({ id: m.id, date: m.date, title: m.title, note: m.note, icon: m.icon, createdAt: ms(m.created_at) });
const mapPlace = (p) => ({
  id: p.id, name: p.name, country: p.country, image: p.image_path || null, status: p.status,
  note: p.note, dreamDate: p.dream_date, targetOn: p.target_on || null, checklist: p.checklist || [],
  visitedOn: p.visited_on || null, createdAt: ms(p.created_at),
});
const mapSong = (s) => ({
  id: s.id, title: s.title, artist: s.artist, link: s.link || null, note: s.note,
  addedBy: s.added_by, favorite: !!s.favorite, month: !!s.month, position: s.position, createdAt: ms(s.created_at),
});
const mapCountdown = (c) => ({ id: c.id, label: c.label, targetAt: ms(c.target_at), icon: c.icon, createdBy: c.created_by, createdAt: ms(c.created_at) });
const mapDate = (d) => ({
  id: d.id, mood: d.mood, duration: d.duration, plan: d.plan, status: d.status, currentStep: d.current_step,
  startedAt: ms(d.started_at), endedAt: ms(d.ended_at), createdBy: d.created_by, createdAt: ms(d.created_at),
});
const mapSession = (s) => ({
  id: s.id, game: s.game, state: s.state || {}, turn: s.turn || null, status: s.status,
  winner: s.winner || null, createdAt: ms(s.created_at), updatedAt: ms(s.updated_at),
});
const mapNotification = (n) => ({ id: n.id, type: n.type, body: n.body, data: n.data || {}, silent: !!n.silent, readAt: ms(n.read_at), createdAt: ms(n.created_at) });
const sanitizeSurprise = (s) => ({
  id: s.id, type: s.type, fromUser: s.from_user, toUser: s.to_user,
  unlockAt: typeof s.unlock_at === 'number' ? s.unlock_at : ms(s.unlock_at),
  openedAt: typeof s.opened_at === 'number' ? s.opened_at : ms(s.opened_at),
  createdAt: typeof s.created_at === 'number' ? s.created_at : ms(s.created_at),
  mine: s.from_user === myUserId, unlocked: (typeof s.unlock_at === 'number' ? s.unlock_at : Date.parse(s.unlock_at)) <= Date.now(),
  forMe: s.to_user === myUserId, payload: s.payload || null,
});
const mapMessage = (m, reactions = [], reads = []) => ({
  id: m.id, sender: m.sender, type: m.type, body: m.body, media: m.media_path || null,
  replyTo: m.reply_to || null, createdAt: ms(m.created_at), deleted: !!m.deleted,
  reactions, reads,
});

/* ---------------- init ---------------- */
export async function initSupabase(env) {
  sb = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  caps.supabase = true;
  caps.google = true; // shown if configured in the dashboard; Supabase errors helpfully if not
  window.__TA_CAPS__ = caps;
  setApiProvider(apiRoute);
  setMediaResolver(resolveMediaUrl);
  setRealtimeProvider({ connect: connectRealtime, disconnect: disconnectRealtime, send: sendShim });

  const { data } = await sb.auth.getSession();
  if (data?.session) { myUserId = data.session.user.id; setToken('sb-session'); }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) { myUserId = session.user.id; setToken('sb-session'); }
    else if (event === 'SIGNED_OUT') { myUserId = null; clearToken(); }
    else if (event === 'PASSWORD_RECOVERY' && session) {
      myUserId = session.user.id; setToken('sb-session');
      window.__TA_RECOVERY__ = true; // app.js routes to the reset form
      try { history.replaceState(null, '', location.pathname); } catch {}
    }
    else if (session) myUserId = session.user.id;
  });
}

/* ---------------- media (signed URLs) ---------------- */
async function resolveMediaUrl(id) {
  if (!id) return null;
  if (isDemoId(id)) return '/img/' + (DEMO_IMG[id] || 'hero-room.jpg');
  const hit = urlCache.get(id);
  if (hit && hit.exp > Date.now() + 60_000) return hit.url;
  try {
    const { data } = await sb.storage.from('media').createSignedUrl(id, 3600);
    if (data?.signedUrl) { urlCache.set(id, { url: data.signedUrl, exp: Date.now() + 3600_000 }); return data.signedUrl; }
  } catch {}
  return null;
}

/* ---------------- the route table ---------------- */
async function apiRoute(method, path, body) {
  const B = body || {};
  let m;

  /* ---- auth ---- */
  if (method === 'POST' && path === '/api/auth/signup') {
    const name = clean(B.name, 120) || 'Someone';
    const { data, error } = await sb.auth.signUp({
      email: clean(B.email, 200).toLowerCase(),
      password: String(B.password || ''),
      options: { data: { name } },
    });
    if (error) throw wrapAuthError(error);
    if (data.session) { myUserId = data.session.user.id; setToken('sb-session'); return { token: 'sb-session', user: { id: data.session.user.id, name } }; }
    throw fail('Almost there — check your inbox to confirm your email, then sign in.', 200);
  }
  if (method === 'POST' && path === '/api/auth/login') {
    const { data, error } = await sb.auth.signInWithPassword({ email: clean(B.email, 200).toLowerCase(), password: String(B.password || '') });
    if (error) throw wrapAuthError(error);
    myUserId = data.session.user.id; setToken('sb-session');
    return { token: 'sb-session', user: { id: data.session.user.id } };
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    try { await sb.auth.signOut(); } catch {}
    myUserId = null; clearToken();
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/auth/reset-request') {
    const { error } = await sb.auth.resetPasswordForEmail(clean(B.email, 200).toLowerCase(), { redirectTo: location.origin + '/app' });
    if (error) throw wrapAuthError(error);
    return { ok: true, demo: false, message: 'If that email exists, a reset link is on its way.' };
  }
  if (method === 'POST' && path === '/api/auth/reset') {
    const { error } = await sb.auth.updateUser({ password: String(B.password || '') });
    if (error) throw wrapAuthError(error);
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/auth/google') {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/app' } });
    if (error) throw wrapAuthError(error);
    return { ok: true };
  }
  if (method === 'POST' && path === '/api/demo/login') {
    const email = DEMO_USERS[B.side] || DEMO_USERS.aisha;
    const { data, error } = await sb.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error) throw fail('The demo world isn\'t set up on this project yet — run scripts/seed-demo.mjs first (see SETUP-SUPABASE.md).');
    myUserId = data.session.user.id; setToken('sb-session');
    return { token: 'sb-session', user: { id: data.session.user.id } };
  }

  /* ---- me ---- */
  if (method === 'GET' && path === '/api/me') {
    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session) { clearToken(); throw fail('Sign in to open your world.', 401); }
    myUserId = sess.session.user.id;
    const snap = await rpc('me_snapshot');
    if (!snap) throw fail('Sign in to open your world.', 401);
    if (snap.partner) snap.partner.mood = snap.partner.mood?.mood ? snap.partner.mood : null;
    return snap;
  }

  /* ---- couple lifecycle ---- */
  if (method === 'POST' && path === '/api/couple') {
    const row = await rpc('create_world', { p_your_name: clean(B.yourName, 60) || 'Me', p_partner_name: clean(B.partnerName, 60) || 'Them' });
    return { couple: mapCouple(row, await membersCount(row.id)) };
  }
  if (method === 'POST' && path === '/api/couple/join') {
    const row = await rpc('join_world', { p_code: clean(B.code, 20).toUpperCase() });
    return { couple: mapCouple(row, await membersCount(row.id)) };
  }
  if (method === 'POST' && path === '/api/couple/dissolve') {
    await rpc('dissolve_world', { p_confirm: String(B.confirm || '') });
    return { ok: true };
  }
  if (method === 'PATCH' && path === '/api/couple') {
    const cid = needCouple();
    const patch = {};
    if (typeof B.name === 'string') patch.name = clean(B.name, 80) || 'Us';
    if (B.anniversary !== undefined) patch.anniversary = DATE_RE.test(B.anniversary || '') ? B.anniversary : null;
    if (B.theme === 'evening' || B.theme === 'morning') patch.theme = B.theme;
    if (B.plan === 'free' || B.plan === 'premium') patch.plan = B.plan;
    if (B.room && typeof B.room === 'object') {
      const { data: cur } = await sb.from('couples').select('room').eq('id', cid).single();
      patch.room = { ...(cur?.room || {}), ...B.room };
    }
    const { data, error } = await sb.from('couples').update(patch).eq('id', cid).select().single();
    if (error) throw wrapPgError(error);
    return { couple: mapCouple(data, store.me?.couple?.members || 2) };
  }

  /* ---- messages ---- */
  if (method === 'GET' && path === '/api/messages') {
    const cid = needCouple();
    const { data, error } = await sb.from('messages').select('*').eq('couple_id', cid).order('created_at', { ascending: false }).limit(60);
    if (error) throw wrapPgError(error);
    const list = (data || []).reverse();
    return { messages: await decorateMessages(list) };
  }
  if (method === 'POST' && path === '/api/messages') {
    const cid = needCouple();
    const type = ['text', 'image', 'voice'].includes(B.type) ? B.type : 'text';
    if (type === 'text' && !clean(B.body, 4000)) throw fail('Say something first.');
    if (type !== 'text' && !(B.media && typeof B.media === 'string')) throw fail('That upload didn\'t come through.');
    const { data, error } = await sb.from('messages').insert({
      couple_id: cid, sender: meId(), type,
      body: type === 'text' ? clean(B.body, 4000) : '',
      media_path: type !== 'text' ? B.media : null,
      reply_to: B.replyTo || null,
    }).select().single();
    if (error) throw wrapPgError(error);
    return { message: mapMessage(data) };
  }
  if (method === 'POST' && path === '/api/messages/read-all') {
    await rpc('mark_all_read');
    return { ok: true };
  }
  if (method === 'POST' && (m = path.match(/^\/api\/messages\/([\w:-]+)\/react$/))) {
    const emoji = typeof B.emoji === 'string' ? [...B.emoji][0] : null;
    if (emoji) {
      const { error } = await sb.from('reactions').upsert({ message_id: m[1], user_id: meId(), emoji });
      if (error) throw wrapPgError(error);
    } else {
      const { error } = await sb.from('reactions').delete().eq('message_id', m[1]).eq('user_id', meId());
      if (error) throw wrapPgError(error);
    }
    return { ok: true };
  }
  if (method === 'DELETE' && (m = path.match(/^\/api\/messages\/([\w:-]+)$/))) {
    const { error } = await sb.from('messages').update({ deleted: true, body: '', media_path: null }).eq('id', m[1]).eq('sender', meId());
    if (error) throw wrapPgError(error);
    return { ok: true };
  }
  if (method === 'GET' && (m = path.match(/^\/api\/messages\/search\?q=(.*)$/))) {
    const cid = needCouple();
    const q = decodeURIComponent(m[1]).slice(0, 100);
    const { data, error } = await sb.from('messages').select('*').eq('couple_id', cid).eq('deleted', false)
      .ilike('body', '%' + q.replace(/[%_]/g, ' ') + '%').order('created_at', { ascending: false }).limit(30);
    if (error) throw wrapPgError(error);
    return { messages: await decorateMessages(data || []) };
  }

  /* ---- memories ---- */
  if (method === 'GET' && path === '/api/memories') {
    const { data, error } = await sb.from('memories').select('*').eq('couple_id', needCouple()).order('happened_on', { ascending: false });
    if (error) throw wrapPgError(error);
    return { memories: (data || []).map(mapMemory) };
  }
  if (method === 'POST' && path === '/api/memories') {
    const { data, error } = await sb.from('memories').insert({
      couple_id: needCouple(), author: meId(),
      type: ['photo', 'note', 'voice', 'song', 'milestone', 'date'].includes(B.type) ? B.type : 'note',
      title: clean(B.title, 120) || 'A memory', body: clean(B.body, 2000),
      media_path: (typeof B.media === 'string' && (isDemoId(B.media) || B.media.includes('/'))) ? B.media : null,
      happened_on: DATE_RE.test(B.happenedOn || '') ? B.happenedOn : today(),
      song_title: clean(B.songTitle, 120) || null, song_artist: clean(B.songArtist, 120) || null,
      pinned: !!B.pinned,
    }).select().single();
    if (error) throw wrapPgError(error);
    return { memory: mapMemory(data) };
  }
  if (method === 'PATCH' && (m = path.match(/^\/api\/memories\/([\w:-]+)$/))) {
    const patch = memoryPatch(B);
    const { data, error } = await sb.from('memories').update(patch).eq('id', m[1]).select().single();
    if (error) throw wrapPgError(error, 'That memory is gone.');
    return { memory: mapMemory(data) };
  }
  if (method === 'DELETE' && (m = path.match(/^\/api\/memories\/([\w:-]+)$/))) {
    const { error } = await sb.from('memories').delete().eq('id', m[1]);
    if (error) throw wrapPgError(error, 'That memory is gone.');
    return { ok: true };
  }

  /* ---- milestones ---- */
  if (method === 'GET' && path === '/api/milestones') {
    const { data, error } = await sb.from('milestones').select('*').eq('couple_id', needCouple()).order('date', { ascending: true });
    if (error) throw wrapPgError(error);
    return { milestones: (data || []).map(mapMilestone) };
  }
  if (method === 'POST' && path === '/api/milestones') {
    const { data, error } = await sb.from('milestones').insert({
      couple_id: needCouple(),
      date: DATE_RE.test(B.date || '') ? B.date : today(),
      title: clean(B.title, 120) || 'A moment', note: clean(B.note, 500),
      icon: clean(B.icon, 4) || '❤️',
    }).select().single();
    if (error) throw wrapPgError(error);
    return { milestone: mapMilestone(data) };
  }
  if (method === 'PATCH' && (m = path.match(/^\/api\/milestones\/([\w:-]+)$/))) {
    const patch = {};
    if (typeof B.title === 'string') patch.title = clean(B.title, 120) || 'A moment';
    if (typeof B.note === 'string') patch.note = clean(B.note, 500);
    if (DATE_RE.test(B.date || '')) patch.date = B.date;
    if (typeof B.icon === 'string') patch.icon = clean(B.icon, 4);
    const { data, error } = await sb.from('milestones').update(patch).eq('id', m[1]).select().single();
    if (error) throw wrapPgError(error, 'Not found.');
    return { milestone: mapMilestone(data) };
  }
  if (method === 'DELETE' && (m = path.match(/^\/api\/milestones\/([\w:-]+)$/))) {
    const { error } = await sb.from('milestones').delete().eq('id', m[1]);
    if (error) throw wrapPgError(error, 'Not found.');
    return { ok: true };
  }

  /* ---- places ---- */
  if (method === 'GET' && path === '/api/places') {
    const { data, error } = await sb.from('places').select('*').eq('couple_id', needCouple()).order('created_at', { ascending: true });
    if (error) throw wrapPgError(error);
    return { places: (data || []).map(mapPlace) };
  }
  if (method === 'POST' && path === '/api/places') {
    const { data, error } = await sb.from('places').insert(placeRow(B, null)).select().single();
    if (error) throw wrapPgError(error);
    return { place: mapPlace(data) };
  }
  if (method === 'PATCH' && (m = path.match(/^\/api\/places\/([\w:-]+)$/))) {
    const patch = placePatch(B);
    if (patch.status === 'visited') patch.visited_on = today();
    const { data, error } = await sb.from('places').update(patch).eq('id', m[1]).select().single();
    if (error) throw wrapPgError(error, 'Not found.');
    return { place: mapPlace(data) };
  }
  if (method === 'DELETE' && (m = path.match(/^\/api\/places\/([\w:-]+)$/))) {
    const { error } = await sb.from('places').delete().eq('id', m[1]);
    if (error) throw wrapPgError(error, 'Not found.');
    return { ok: true };
  }

  /* ---- songs ---- */
  if (method === 'GET' && path === '/api/songs') {
    const { data, error } = await sb.from('songs').select('*').eq('couple_id', needCouple()).order('position', { ascending: true });
    if (error) throw wrapPgError(error);
    return { songs: (data || []).map(mapSong) };
  }
  if (method === 'POST' && path === '/api/songs') {
    const cid = needCouple();
    const { count } = await sb.from('songs').select('*', { count: 'exact', head: true }).eq('couple_id', cid);
    const { data, error } = await sb.from('songs').insert({
      couple_id: cid,
      title: clean(B.title, 120) || 'Untitled', artist: clean(B.artist, 120),
      link: /^https?:\/\//.test(B.link || '') ? clean(B.link, 500) : null,
      note: clean(B.note, 300), added_by: meId(), favorite: false, month: false, position: count || 0,
    }).select().single();
    if (error) throw wrapPgError(error);
    return { song: mapSong(data) };
  }
  if (method === 'PATCH' && (m = path.match(/^\/api\/songs\/([\w:-]+)$/))) {
    const cid = needCouple();
    const id = m[1];
    if (B.move === 'up' || B.move === 'down') return moveSong(cid, id, B.move);
    const patch = {};
    if (typeof B.favorite === 'boolean') patch.favorite = B.favorite;
    if (B.month === true) {
      await sb.from('songs').update({ month: false }).eq('couple_id', cid);
      patch.month = true;
    } else if (B.month === false) patch.month = false;
    if (typeof B.note === 'string') patch.note = clean(B.note, 300);
    if (typeof B.link === 'string') patch.link = /^https?:\/\//.test(B.link) ? clean(B.link, 500) : null;
    const { data, error } = await sb.from('songs').update(patch).eq('id', id).select().single();
    if (error) throw wrapPgError(error, 'Not found.');
    return { song: mapSong(data) };
  }
  if (method === 'DELETE' && (m = path.match(/^\/api\/songs\/([\w:-]+)$/))) {
    const { error } = await sb.from('songs').delete().eq('id', m[1]);
    if (error) throw wrapPgError(error, 'Not found.');
    return { ok: true };
  }

  /* ---- countdowns ---- */
  if (method === 'GET' && path === '/api/countdowns') {
    const { data, error } = await sb.from('countdowns').select('*').eq('couple_id', needCouple()).order('target_at', { ascending: true });
    if (error) throw wrapPgError(error);
    return { countdowns: (data || []).map(mapCountdown) };
  }
  if (method === 'POST' && path === '/api/countdowns') {
    const targetAt = Number(B.targetAt);
    if (!targetAt || targetAt < Date.now() + 60_000) throw fail('Pick a time in the future.');
    const { data, error } = await sb.from('countdowns').insert({
      couple_id: needCouple(), label: clean(B.label, 120) || 'until we meet again',
      target_at: new Date(targetAt).toISOString(), icon: clean(B.icon, 4) || '✈️', created_by: meId(),
    }).select().single();
    if (error) throw wrapPgError(error);
    return { countdown: mapCountdown(data) };
  }
  if (method === 'DELETE' && (m = path.match(/^\/api\/countdowns\/([\w:-]+)$/))) {
    const { error } = await sb.from('countdowns').delete().eq('id', m[1]);
    if (error) throw wrapPgError(error, 'Not found.');
    return { ok: true };
  }

  /* ---- dates ---- */
  if (method === 'POST' && path === '/api/dates/plan') {
    needCouple();
    return { plan: planDate({ minutes: B.minutes, mood: B.mood, energy: B.energy, notes: B.notes || '' }) };
  }
  if (method === 'GET' && path === '/api/dates') {
    const { data, error } = await sb.from('dates').select('*').eq('couple_id', needCouple()).order('created_at', { ascending: false });
    if (error) throw wrapPgError(error);
    return { dates: (data || []).map(mapDate) };
  }
  if (method === 'POST' && path === '/api/dates') {
    if (!B.plan || !Array.isArray(B.plan.steps)) throw fail('That plan didn\'t come through.');
    const { data, error } = await sb.from('dates').insert({
      couple_id: needCouple(), mood: clean(B.plan.mood, 20),
      duration: Number(B.plan.minutes) || 45,
      plan: { ...B.plan, steps: B.plan.steps.slice(0, 12) },
      status: 'saved', current_step: -1, created_by: meId(),
    }).select().single();
    if (error) throw wrapPgError(error);
    return { date: mapDate(data) };
  }
  if (method === 'POST' && (m = path.match(/^\/api\/dates\/([\w:-]+)\/start$/))) {
    const { data, error } = await sb.from('dates').update({ status: 'active', current_step: 0, started_at: new Date().toISOString(), ended_at: null })
      .eq('id', m[1]).select().single();
    if (error) throw wrapPgError(error, 'That date isn\'t here anymore.');
    myDateAction = { id: m[1], type: 'started', at: Date.now() };
    return { date: mapDate(data) };
  }
  if (method === 'POST' && (m = path.match(/^\/api\/dates\/([\w:-]+)\/advance$/))) {
    const dir = B.dir === -1 ? -1 : 1;
    const { data: d, error } = await sb.from('dates').select('*').eq('id', m[1]).single();
    if (error || !d) throw fail('That date isn\'t here anymore.', 404);
    const len = (d.plan?.steps || []).length;
    const next = Math.max(0, Math.min(len - 1, (d.current_step ?? -1) + dir));
    const { data: out, error: e2 } = await sb.from('dates').update({ current_step: next }).eq('id', m[1]).select().single();
    if (e2) throw wrapPgError(e2);
    myDateAction = { id: m[1], type: 'step', at: Date.now() };
    return { date: mapDate(out) };
  }
  if (method === 'POST' && (m = path.match(/^\/api\/dates\/([\w:-]+)\/finish$/))) {
    const { data: d, error } = await sb.from('dates').select('*').eq('id', m[1]).single();
    if (error || !d) throw fail('That date isn\'t here anymore.', 404);
    const { data: out, error: e2 } = await sb.from('dates').update({ status: 'done', ended_at: new Date().toISOString() }).eq('id', m[1]).select().single();
    if (e2) throw wrapPgError(e2);
    let memory = null;
    if (B.memory) {
      const { data: mem, error: e3 } = await sb.from('memories').insert({
        couple_id: d.couple_id, author: meId(), type: 'date',
        title: d.plan?.title || 'A date night', body: (d.plan?.notes ? String(d.plan.notes).slice(0, 2000) : ''),
        happened_on: today(),
      }).select().single();
      if (!e3) memory = mapMemory(mem);
    }
    myDateAction = { id: m[1], type: 'ended', at: Date.now() };
    return { date: mapDate(out), memory };
  }
  if (method === 'DELETE' && (m = path.match(/^\/api\/dates\/([\w:-]+)$/))) {
    const { error } = await sb.from('dates').delete().eq('id', m[1]);
    if (error) throw wrapPgError(error);
    return { ok: true };
  }

  /* ---- games (server-authoritative RPCs) ---- */
  if (method === 'POST' && path === '/api/games/start') {
    const s = await rpc('game_start', { p_game: B.game, p_state: initialState(B.game) });
    return { session: mapSession(s) };
  }
  if (method === 'GET' && (m = path.match(/^\/api\/games\/([\w:-]+)$/))) {
    const { data, error } = await sb.from('game_sessions').select('*').eq('id', m[1]).single();
    if (error || !data) throw fail('That game isn\'t here anymore.', 404);
    return { session: mapSession(data) };
  }
  if (method === 'POST' && (m = path.match(/^\/api\/games\/([\w:-]+)\/move$/))) {
    const payload = {};
    if (B.move !== undefined) payload.move = B.move;
    if (B.action !== undefined) payload.action = B.action;
    if (B.stroke !== undefined) payload.stroke = B.stroke;
    if (B.color !== undefined) payload.color = B.color;
    if (B.size !== undefined) payload.size = B.size;
    if (B.prompt !== undefined) payload.prompt = B.prompt;
    const s = await rpc('game_move', { p_session: m[1], p_payload: payload });
    return { session: mapSession(s) };
  }
  if (method === 'POST' && (m = path.match(/^\/api\/games\/([\w:-]+)\/reset$/))) {
    const { data: cur } = await sb.from('game_sessions').select('game').eq('id', m[1]).single();
    const s = await rpc('game_reset', { p_session: m[1], p_state: initialState(cur?.game || B.game) });
    return { session: mapSession(s) };
  }

  /* ---- surprises (payload sealed by RLS until unlock) ---- */
  if (method === 'GET' && path === '/api/surprises') {
    needCouple();
    return { surprises: await rpc('list_surprises') };
  }
  if (method === 'POST' && path === '/api/surprises') {
    const p = needPartner();
    const type = ['letter', 'gift', 'invite', 'memories'].includes(B.type) ? B.type : 'letter';
    const unlockAt = Number(B.unlockAt);
    if (!unlockAt || unlockAt < Date.now() - 60_000 || unlockAt > Date.now() + 365 * 86400000) throw fail('Pick an unlock time in the future.');
    const { data, error } = await sb.from('surprises').insert({
      couple_id: store.me.couple.id, from_user: meId(), to_user: p.id, type,
      payload: {
        title: clean(B.title, 120) || 'For you', body: clean(B.body, 4000),
        gift: clean(B.gift, 8), note: clean(B.note, 1000), dateLabel: clean(B.dateLabel, 120),
      },
      unlock_at: new Date(unlockAt).toISOString(),
    }).select().single();
    if (error) throw wrapPgError(error);
    return { surprise: sanitizeSurprise(data) };
  }
  if (method === 'POST' && (m = path.match(/^\/api\/surprises\/([\w:-]+)\/open$/))) {
    return { surprise: await rpc('open_surprise', { p_id: m[1] }) };
  }
  if (method === 'DELETE' && (m = path.match(/^\/api\/surprises\/([\w:-]+)$/))) {
    const { error } = await sb.from('surprises').delete().eq('id', m[1]).eq('from_user', meId());
    if (error) throw wrapPgError(error, 'That surprise is gone.');
    return { ok: true };
  }

  /* ---- room / mood / presence / profile ---- */
  if (method === 'PUT' && path === '/api/room') {
    const cid = needCouple();
    if (!B.patch && typeof B !== 'object') throw fail('That didn\'t come through.');
    const patch = B.patch || B;
    const { data: cur } = await sb.from('couples').select('room').eq('id', cid).single();
    const room = { ...(cur?.room || {}), ...patch };
    const { data, error } = await sb.from('couples').update({ room }).eq('id', cid).select().single();
    if (error) throw wrapPgError(error);
    return { room: data.room };
  }
  if (method === 'PUT' && path === '/api/mood') {
    const mood = (typeof B.mood === 'string' && B.mood) ? clean(B.mood, 20) : null;
    const { error } = await sb.from('members').update({ mood, mood_updated_at: new Date().toISOString() }).eq('user_id', meId());
    if (error) throw wrapPgError(error);
    return { mood };
  }
  if (method === 'GET' && path === '/api/presence') {
    needCouple();
    const { data: mems } = await sb.from('members').select('user_id, mood, mood_updated_at');
    const moods = {};
    (mems || []).forEach((x) => { moods[x.user_id] = { mood: x.mood, updatedAt: ms(x.mood_updated_at) }; });
    return { presence: presenceSnapshot(), moods };
  }
  if (method === 'POST' && path === '/api/profile') {
    const p = {};
    const mm = {};
    if (typeof B.name === 'string') p.name = clean(B.name, 120) || 'Someone';
    if (B.avatar !== undefined) p.avatar_path = (typeof B.avatar === 'string' && (isDemoId(B.avatar) || B.avatar.includes('/'))) ? B.avatar : null;
    if (typeof B.tz === 'string') p.tz = clean(B.tz, 60);
    if (typeof B.displayName === 'string') mm.display_name = clean(B.displayName, 60) || null;
    if (typeof B.accent === 'string') mm.accent = clean(B.accent, 20);
    if (typeof B.hair === 'string') mm.hair = clean(B.hair, 20);
    if (Object.keys(p).length) { const { error } = await sb.from('profiles').update(p).eq('id', meId()); if (error) throw wrapPgError(error); }
    if (Object.keys(mm).length) { const { error } = await sb.from('members').update(mm).eq('user_id', meId()); if (error) throw wrapPgError(error); }
    return { ok: true };
  }

  /* ---- media upload ---- */
  if (method === 'POST' && path === '/api/media') {
    const cid = needCouple();
    const file = body;
    if (!(file instanceof Blob)) throw fail('That upload didn\'t come through.');
    const path = `${cid}/${(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2))}`;
    const { error } = await sb.storage.from('media').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw wrapPgError(error, 'That upload didn\'t come through. Try again?');
    return { media: { id: path } };
  }

  /* ---- decks ---- */
  if (method === 'GET' && (m = path.match(/^\/api\/decks\/(\w+)$/))) {
    const deck = decks[m[1]];
    if (!deck) throw fail('That deck is missing.', 404);
    return { deck };
  }

  /* ---- notifications ---- */
  if (method === 'GET' && path === '/api/notifications') {
    const { data, error } = await sb.from('notifications').select('*').eq('user_id', meId()).order('created_at', { ascending: false }).limit(60);
    if (error) throw wrapPgError(error);
    const list = (data || []).map(mapNotification);
    const { data: pf } = await sb.from('notif_prefs').select('*').eq('user_id', meId()).maybeSingle();
    const prefs = pf ? { messages: pf.messages, surprises: pf.surprises, dates: pf.dates, memories: pf.memories, moods: pf.moods, presence: pf.presence } : {};
    return { notifications: list, prefs, unread: list.filter((n) => !n.readAt).length };
  }
  if (method === 'POST' && path === '/api/notifications/read') {
    const stamp = new Date().toISOString();
    const { error } = B.all !== true && B.id
      ? await sb.from('notifications').update({ read_at: stamp }).eq('id', B.id).eq('user_id', meId())
      : await sb.from('notifications').update({ read_at: stamp }).eq('user_id', meId()).is('read_at', null);
    if (error) throw wrapPgError(error);
    return { ok: true };
  }
  if (method === 'PUT' && path === '/api/notifications/prefs') {
    const fields = ['messages', 'surprises', 'dates', 'memories', 'moods', 'presence'];
    const patch = {};
    fields.forEach((f) => { if (typeof B[f] === 'boolean') patch[f] = B[f]; });
    const { data, error } = await sb.from('notif_prefs').upsert({ user_id: meId(), ...patch }).select().single();
    if (error) throw wrapPgError(error);
    return { prefs: { messages: data.messages, surprises: data.surprises, dates: data.dates, memories: data.memories, moods: data.moods, presence: data.presence } };
  }

  throw fail('That part of the world isn\'t here.', 404);
}

function wrapAuthError(e) {
  const msg = String(e?.message || '');
  if (/invalid login credentials/i.test(msg)) return fail('That email and password don\'t match. Try again?');
  if (/already registered|already been registered/i.test(msg)) return fail('That email already has a world here. Sign in instead?');
  if (/password/i.test(msg) && /at least|weak/i.test(msg)) return fail('Pick a password of at least 6 characters.');
  if (/rate limit/i.test(msg)) return fail('Too many tries — wait a minute and try again.');
  if (/not confirmed|email_not_confirmed/i.test(msg)) return fail('Check your inbox to confirm your email first.');
  if (/unable to validate email/i.test(msg)) return fail('That email doesn\'t look right.');
  return fail(msg || 'That didn\'t work. Try again?');
}

/* ---------------- small helpers for routes ---------------- */
async function decorateMessages(list) {
  if (!list.length) return [];
  const ids = list.map((x) => x.id);
  const [{ data: rx }, { data: rd }] = await Promise.all([
    sb.from('reactions').select('message_id, user_id, emoji').in('message_id', ids),
    sb.from('reads').select('message_id, user_id').in('message_id', ids),
  ]);
  const rmap = {}, dmap = {};
  (rx || []).forEach((r) => { (rmap[r.message_id] = rmap[r.message_id] || []).push({ userId: r.user_id, emoji: r.emoji }); });
  (rd || []).forEach((r) => { (dmap[r.message_id] = dmap[r.message_id] || []).push(r.user_id); });
  return list.map((x) => mapMessage(x, rmap[x.id] || [], dmap[x.id] || []));
}
function memoryPatch(B) {
  const patch = {};
  if (typeof B.title === 'string') patch.title = clean(B.title, 120) || 'A memory';
  if (typeof B.body === 'string') patch.body = clean(B.body, 2000);
  if (DATE_RE.test(B.happenedOn || '')) patch.happened_on = B.happenedOn;
  if (typeof B.pinned === 'boolean') patch.pinned = B.pinned;
  if (typeof B.songTitle === 'string') patch.song_title = clean(B.songTitle, 120) || null;
  if (typeof B.songArtist === 'string') patch.song_artist = clean(B.songArtist, 120) || null;
  return patch;
}
function placeRow(B, _old) {
  return {
    couple_id: needCouple(),
    name: clean(B.name, 80) || 'Somewhere', country: clean(B.country, 60),
    image_path: (typeof B.image === 'string' && (isDemoId(B.image) || B.image.includes('/'))) ? B.image : null,
    status: ['dreaming', 'planned', 'visited'].includes(B.status) ? B.status : 'dreaming',
    note: clean(B.note, 500), dream_date: clean(B.dreamDate, 500),
    target_on: DATE_RE.test(B.targetOn || '') ? B.targetOn : null,
    checklist: sanitizeChecklist(B.checklist), visited_on: null,
  };
}
function placePatch(B) {
  const patch = {};
  for (const [f, col, n] of [['name', 'name', 80], ['country', 'country', 60], ['note', 'note', 500], ['dreamDate', 'dream_date', 500]]) {
    if (typeof B[f] === 'string') patch[col] = clean(B[f], n);
  }
  if (['dreaming', 'planned', 'visited'].includes(B.status)) patch.status = B.status;
  if (DATE_RE.test(B.targetOn || '')) patch.target_on = B.targetOn;
  if (Array.isArray(B.checklist)) patch.checklist = sanitizeChecklist(B.checklist);
  return patch;
}
const sanitizeChecklist = (list) => (Array.isArray(list) ? list.slice(0, 30).map((c) => ({ t: clean(c?.t, 120), done: !!c?.done })) : []);
async function moveSong(cid, id, dir) {
  const { data: list } = await sb.from('songs').select('*').eq('couple_id', cid).order('position', { ascending: true });
  const arr = list || [];
  const i = arr.findIndex((s) => s.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= arr.length) return { song: mapSong(arr[i]) };
  await Promise.all([
    sb.from('songs').update({ position: arr[j].position }).eq('id', arr[i].id),
    sb.from('songs').update({ position: arr[i].position }).eq('id', arr[j].id),
  ]);
  return { song: mapSong({ ...arr[i], position: arr[j].position }) };
}

/* ---------------- games: client-supplied decks (logic stays in Postgres) ---------------- */
const GLYPHS = ['🌙', '☕', 'Letters', '🌧️', '✉️', '🕯️', '🎧', '🌿', '🕯', '🫖'];
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
function initialState(game) {
  if (game === 'memory') {
    const glyphs = shuffle(GLYPHS).slice(0, 8);
    return { deck: shuffle([...glyphs, ...glyphs]).map((g, i) => ({ i, g })) };
  }
  if (game === 'wyr') return { qs: shuffle(decks.wyr).slice(0, 12).map((q) => ({ text: q })) };
  if (game === 'thisthat') return { qs: shuffle(decks.thisorthat).slice(0, 12).map((q) => ({ options: q })) };
  if (game === 'draw') return { prompt: decks.draw[Math.floor(Math.random() * decks.draw.length)] };
  return {};
}

/* ---------------- realtime (stands in for the WebSocket) ---------------- */
function presenceSnapshot() {
  if (!channel) return {};
  const state = channel.presenceState();
  const out = {};
  Object.keys(state).forEach((key) => {
    if (key === myUserId) return;
    const m = state[key]?.[0] || {};
    out[key] = { online: true, state: m.state || 'online', activity: m.activity || null, spot: m.spot || null, tz: m.tz || null, lastSeen: m.lastSeen || Date.now() };
  });
  return out;
}

export async function connectRealtime() {
  if (!sb || !store.me?.couple) return;
  const cid = store.me.couple.id;
  myUserId = store.me.user.id;
  await disconnectRealtime();
  channel = sb.channel('ta-couple-' + cid, { config: { presence: { key: myUserId }, broadcast: { self: false } } });

  channel.on('presence', { event: 'sync' }, () => { emit('ws:presence', { presence: presenceSnapshot() }); });
  channel.on('presence', { event: 'join' }, () => {});
  channel.on('broadcast', { event: 'msg' }, ({ payload }) => handleBroadcast(payload));

  const onRow = (table, filter, fn) => channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, fn);
  for (const t of ['messages', 'reactions', 'reads', 'memories', 'milestones', 'places', 'songs', 'countdowns', 'surprises', 'dates', 'game_sessions', 'members']) {
    onRow(t, `couple_id=eq.${cid}`, (p) => handleRow(t, p));
  }
  onRow('couples', `id=eq.${cid}`, (p) => handleRow('couples', p));
  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${myUserId}` },
    (p) => {
      emit('ws:notify', { notification: mapNotification(p.new) });
      if (p.new?.type === 'surprises') emit('ws:surprise:unlocked', {}); // refresh the shelf
    });

  const st = await new Promise((res) => channel.subscribe((s2) => res(s2)));
  if (st !== 'SUBSCRIBED' && st !== 'CLOSED') { /* channel error — presence just stays quiet */ }
  myMeta = { state: 'online', tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lastSeen: Date.now() };
  try { await channel.track(myMeta); } catch {}
  emit('ws:up', {});
  rpc('collect_unlocked_surprises').catch(() => {});
  unlockTimer = setInterval(() => { rpc('collect_unlocked_surprises').catch(() => {}); myMeta.lastSeen = Date.now(); }, 60_000);
}

export async function disconnectRealtime() {
  clearInterval(unlockTimer); unlockTimer = null;
  if (channel) { const c = channel; channel = null; try { await sb.removeChannel(c); } catch {} }
}

function sendShim(obj) {
  if (!channel) return;
  if (obj?.t === 'presence') {
    myMeta = { ...myMeta, state: obj.state || myMeta.state, activity: obj.activity ?? null, tz: obj.tz || myMeta.tz, lastSeen: Date.now() };
    channel.track(myMeta);
    return;
  }
  channel.send({ type: 'broadcast', event: 'msg', payload: { ...obj, from: myUserId } });
}

function handleBroadcast(p) {
  if (!p || !p.t) return;
  switch (p.t) {
    case 'typing': emit('ws:chat:typing', { userId: p.from }); break;
    case 'avatar:move': emit('ws:avatar:move', { userId: p.from, spot: p.spot }); break;
    case 'interaction': emit('ws:interaction', { from: p.from, type: p.type }); break;
    case 'float': emit('ws:float', { from: p.from, emoji: p.emoji }); break;
    case 'stay': emit('ws:stay', { ...p, from: p.from }); break;
    case 'call:signal': emit('ws:call:signal', { from: p.from, data: p.data }); break;
    case 'song:sync': emit('ws:song:sync', { from: p.from, data: p.data }); break;
    case 'room:patch': emit('ws:room:patch', { by: p.from, patch: p.patch }); break;
    default: break;
  }
}

async function handleRow(table, p) {
  const ev = p.eventType || p.event;
  const row = p.new || p.old;
  if (!row) return;
  switch (table) {
    case 'messages': {
      if (ev === 'INSERT') emit('ws:chat:message', { message: mapMessage(row, [], []) });
      else if (ev === 'UPDATE' && row.deleted) emit('ws:chat:delete', { id: row.id });
      break;
    }
    case 'reactions': {
      const mid = row.message_id;
      const { data } = await sb.from('reactions').select('user_id, emoji').eq('message_id', mid);
      emit('ws:chat:react', { messageId: mid, reactions: (data || []).map((r) => ({ userId: r.user_id, emoji: r.emoji })) });
      break;
    }
    case 'reads': emit('ws:chat:read', { userId: row.user_id }); break;
    case 'couples': emit('ws:entity', { verb: 'update', kind: 'couple', item: mapCouple(row) }); break;
    case 'members': emit('ws:mood', { userId: row.user_id, mood: row.mood }); emit('ws:profile', {}); break;
    case 'dates': {
      const d = mapDate(row);
      const prev = dateCache.get(d.id) || { status: 'saved', currentStep: -1 };
      if (ev === 'UPDATE') {
        let type = null;
        if (d.status === 'active' && prev.status !== 'active') type = 'started';
        else if (d.status === 'done' && prev.status !== 'done') type = 'ended';
        else if (d.currentStep !== prev.currentStep) type = 'step';
        if (type) {
          const mine = myDateAction && myDateAction.id === d.id && myDateAction.type === type && Date.now() - myDateAction.at < 8000;
          emit('ws:date:event', { id: d.id, type, date: d, by: mine ? myUserId : null });
        }
      }
      dateCache.set(d.id, { status: d.status, currentStep: d.currentStep });
      emit('ws:entity', { verb: ev === 'DELETE' ? 'delete' : (ev === 'INSERT' ? 'new' : 'update'), kind: 'dates', item: d });
      break;
    }
    case 'game_sessions': emit('ws:game:state', { session: mapSession(row), started: ev === 'INSERT' }); break;
    case 'surprises': emit('ws:entity', { verb: ev === 'DELETE' ? 'delete' : (ev === 'INSERT' ? 'new' : 'update'), kind: 'surprises', item: { id: row.id } }); break;
    default: {
      // memories, milestones, places, songs, countdowns
      const kind = table;
      const mappers = { memories: mapMemory, milestones: mapMilestone, places: mapPlace, songs: mapSong, countdowns: mapCountdown };
      const item = ev === 'DELETE' ? { id: row.id } : (mappers[kind] ? mappers[kind](row) : row);
      emit('ws:entity', { verb: ev === 'DELETE' ? 'delete' : (ev === 'INSERT' ? 'new' : 'update'), kind, item });
      break;
    }
  }
}
