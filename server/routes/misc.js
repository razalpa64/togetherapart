import fs from 'node:fs';
import path from 'node:path';
import { ok, fail, clean, now, rate, readBody } from '../lib/util.js';
import { T, one, save, byId, db, MEDIA_DIR } from '../lib/db.js';
import { decks } from '../content/decks.js';

const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const AUD_TYPES = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'video/webm;codecs=opus': 'webm' };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const DEMO_IMG = {
  'demo:hero-room': 'hero-room.jpg', 'demo:moment-watch': 'moment-watch.jpg', 'demo:moment-game': 'moment-game.jpg',
  'demo:moment-memories': 'moment-memories.jpg', 'demo:moment-dinner': 'moment-dinner.jpg', 'demo:surprise-letter': 'surprise-letter.jpg',
  'demo:stay-rain': 'stay-rain.jpg', 'demo:stay-balcony': 'stay-balcony.jpg', 'demo:stay-beach': 'stay-beach.jpg', 'demo:stay-cabin': 'stay-cabin.jpg',
};

function serveFile(res, file, mime) {
  const stat = fs.statSync(file);
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Cache-Control': 'private, max-age=86400' });
  fs.createReadStream(file).pipe(res);
}

export const routes = [
  ['GET', /^\/api\/health$/, async ({ res }) => ok(res, { ok: true, name: 'Together, Apart' })],

  ['PUT', /^\/api\/mood$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const valid = decks.moods.map(m => m.id);
    const mood = valid.includes(body.mood) ? body.mood : null;
    db().moods[user.id] = { mood, updatedAt: now() };
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'mood', userId: user.id, mood });
    if (ctx.partner && mood === 'needyou') ctx.notify(ctx.partner.userId, 'moods', `${user.name} needs you right now.`);
    else if (ctx.partner && mood && ['low', 'overwhelmed', 'tired'].includes(mood)) ctx.notify(ctx.partner.userId, 'moods', `${user.name} is feeling ${mood === 'needyou' ? '' : decks.moods.find(m => m.id === mood)?.label?.toLowerCase() || mood} tonight.`);
    return ok(res, { mood });
  }],

  ['PUT', /^\/api\/room$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const patch = {};
    const r = ctx.couple.room || {};
    for (const k of ['scene', 'window', 'music']) if (typeof body[k] === 'string') patch[k] = clean(body[k], 40);
    for (const k of ['lamp', 'stringLights', 'candle']) if (typeof body[k] === 'boolean') patch[k] = body[k];
    if (typeof body.volume === 'number') patch.volume = Math.min(Math.max(body.volume, 0), 1);
    ctx.couple.room = { ...r, ...patch };
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'room:patch', patch, by: user.id });
    return ok(res, { room: ctx.couple.room });
  }],

  ['GET', /^\/api\/presence$/, async ({ res, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    return ok(res, {
      presence: ctx.rt.snapshotFor(ctx.coupleId, ctx.user?.id),
      moods: { [ctx.user?.id]: db().moods[ctx.user?.id] || null, ...(ctx.partner ? { [ctx.partner.userId]: db().moods[ctx.partner.userId] || null } : {}) },
    });
  }],

  ['POST', /^\/api\/profile$/, async ({ res, body, user, ctx }) => {
    const u = byId('users', user.id);
    if (!u) return fail(res, 404, 'Account not found.');
    if (typeof body.name === 'string' && clean(body.name, 40)) u.name = clean(body.name, 40);
    if (body.avatar === null) u.avatar = null;
    else if (typeof body.avatar === 'string' && (String(body.avatar).startsWith('demo:') || one('media', m => m.id === body.avatar))) u.avatar = body.avatar;
    if (typeof body.tz === 'string') u.tz = clean(body.tz, 60);
    if (ctx.member) {
      if (typeof body.displayName === 'string' && clean(body.displayName, 40)) ctx.member.displayName = clean(body.displayName, 40);
      if (['rose', 'amber', 'sage', 'slate', 'burgundy'].includes(body.accent)) ctx.member.accent = body.accent;
      if (['short', 'medium', 'long', 'curl', 'bun'].includes(body.hair)) ctx.member.hair = body.hair;
    }
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'profile' });
    return ok(res, { ok: true });
  }],

  ['POST', /^\/api\/media$/, async ({ req, res, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    if (!rate('media:' + user.id, 40, 3600_000)) return fail(res, 429, 'That\'s a lot of uploads for one hour — try again later.');
    const mime = (req.headers['content-type'] || '').split(';')[0].trim();
    const ext = IMG_TYPES[mime] || AUD_TYPES[mime];
    if (!ext) return fail(res, 400, 'That file type isn\'t supported yet.');
    const buf = await readBody(req, 8 * 1024 * 1024);
    if (!buf.length) return fail(res, 400, 'The file came through empty. Try again?');
    const m = { id: 'md-' + require('node:crypto').randomBytes(8).toString('hex') ? 'md-' + cryptoRandom() : null, coupleId: ctx.coupleId, mime, size: buf.length, ext, createdAt: now() };
    m.id = 'md-' + cryptoRandom();
    fs.writeFileSync(path.join(MEDIA_DIR, m.id + '.' + ext), buf);
    T('media').push(m);
    save();
    return ok(res, { media: m });
  }],
  ['GET', /^\/api\/media\/([\w:%-]+)$/, async ({ res, params, ctx, user }) => {
    const mid = decodeURIComponent(params[0]);
    if (mid.startsWith('demo:')) {
      if (!ctx.coupleId) return fail(res, 404, 'Not found.');
      const f = DEMO_IMG[mid];
      if (!f) return fail(res, 404, 'Not found.');
      return serveFile(res, path.join(ROOT, 'public', 'img', f), 'image/jpeg');
    }
    const m = byId('media', mid);
    if (!m || m.coupleId !== ctx.coupleId) return fail(res, 404, 'Not found.');
    const file = path.join(MEDIA_DIR, m.id + '.' + m.ext);
    if (!fs.existsSync(file)) return fail(res, 404, 'Not found.');
    return serveFile(res, file, m.mime);
  }],

  ['GET', /^\/api\/decks\/(\w+)$/, async ({ res, params }) => {
    const d = decks[params[0]];
    if (!d) return fail(res, 404, 'No such deck.');
    return ok(res, { deck: d });
  }],

  ['GET', /^\/api\/notifications$/, async ({ res, user }) => {
    const list = T('notifications').filter(n => n.userId === user.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 60);
    return ok(res, { notifications: list, prefs: db().notifPrefs[user.id] || null, unread: list.filter(n => !n.readAt).length });
  }],
  ['POST', /^\/api\/notifications\/read$/, async ({ res, body, user }) => {
    for (const n of T('notifications')) {
      if (n.userId !== user.id) continue;
      if (body.all || n.id === body.id) n.readAt = n.readAt || now();
    }
    save();
    return ok(res, { ok: true });
  }],
  ['PUT', /^\/api\/notifications\/prefs$/, async ({ res, body, user }) => {
    const prefs = { ...(db().notifPrefs[user.id] || {}) };
    for (const k of ['messages', 'surprises', 'dates', 'memories', 'moods', 'presence']) {
      if (typeof body[k] === 'boolean') prefs[k] = body[k];
    }
    db().notifPrefs[user.id] = prefs;
    save();
    return ok(res, { prefs });
  }],
];

function cryptoRandom() { return crypto.randomBytes(9).toString('base64url'); }
