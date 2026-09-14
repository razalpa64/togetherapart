import { ok, fail, clean, now, id } from '../lib/util.js';
import { T, one, save, byId } from '../lib/db.js';

const sanitize = (s, userId) => {
  const mine = s.fromUser === userId;
  const unlocked = Date.now() >= s.unlockAt;
  const out = {
    id: s.id, type: s.type, fromUser: s.fromUser, toUser: s.toUser,
    unlockAt: s.unlockAt, openedAt: s.openedAt, createdAt: s.createdAt,
    mine, unlocked, forMe: s.toUser === userId,
  };
  // The payload never leaves the server before its time.
  if (mine || (unlocked)) {
    try { out.payload = JSON.parse(s.payload); } catch { out.payload = null; }
  }
  return out;
};

export const routes = [
  ['GET', /^\/api\/surprises$/, async ({ res, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const list = T('surprises').filter(s => s.coupleId === ctx.coupleId).sort((a, b) => b.unlockAt - a.unlockAt);
    return ok(res, { surprises: list.map(s => sanitize(s, user.id)) });
  }],
  ['POST', /^\/api\/surprises$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    if (!ctx.partner) return fail(res, 409, 'You\'ll need your partner in the world first.');
    const type = ['letter', 'gift', 'invite', 'memories'].includes(body.type) ? body.type : 'letter';
    const unlockAt = Number(body.unlockAt);
    if (!unlockAt || unlockAt < Date.now() - 60_000 || unlockAt > Date.now() + 365 * 86400000) return fail(res, 400, 'Pick an unlock time in the future.');
    const payload = JSON.stringify({
      title: clean(body.title, 120) || 'For you',
      body: clean(body.body, 4000),
      gift: clean(body.gift, 8),
      note: clean(body.note, 1000),
      dateLabel: clean(body.dateLabel, 120),
    });
    const s = { id: id('x'), coupleId: ctx.coupleId, fromUser: user.id, toUser: ctx.partner.userId, type, payload, unlockAt, openedAt: null, notifiedAt: null, createdAt: now() };
    T('surprises').push(s);
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'entity', verb: 'new', kind: 'surprises', item: sanitize(s, ctx.partner.userId) });
    ctx.notify(ctx.partner.userId, 'surprises', 'They left you a surprise. It opens ' + whenLabel(unlockAt) + '.');
    return ok(res, { surprise: sanitize(s, user.id) });
  }],
  ['POST', /^\/api\/surprises\/([\w:-]+)\/open$/, async ({ res, params, user, ctx }) => {
    const s = byId('surprises', params[0]);
    if (!s || s.coupleId !== ctx.coupleId) return fail(res, 404, 'That surprise is gone.');
    if (s.toUser !== user.id) return fail(res, 403, 'This one isn\'t yours to open.');
    if (Date.now() < s.unlockAt) return fail(res, 423, 'Not yet. It\'s still sealed.');
    if (!s.openedAt) { s.openedAt = now(); save(); }
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'entity', verb: 'update', kind: 'surprises', item: sanitize(s, user.id) });
    return ok(res, { surprise: sanitize(s, user.id) });
  }],
  ['DELETE', /^\/api\/surprises\/([\w:-]+)$/, async ({ res, params, user, ctx }) => {
    const s = byId('surprises', params[0]);
    if (!s || s.coupleId !== ctx.coupleId || s.fromUser !== user.id) return fail(res, 404, 'That surprise is gone.');
    T('surprises').splice(T('surprises').indexOf(s), 1);
    save();
    ctx.entity('delete', 'surprises', { id: s.id, coupleId: ctx.coupleId });
    return ok(res, { ok: true });
  }],
];

function whenLabel(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(ts); target.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return 'today at ' + time;
  if (days === 1) return 'tomorrow at ' + time;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' at ' + time;
}

// Unlock watcher: announces the moment a surprise becomes openable.
export function watchSurprises(rt, notify) {
  setInterval(() => {
    const t = Date.now();
    let changed = false;
    for (const s of T('surprises')) {
      if (!s.notifiedAt && t >= s.unlockAt) {
        s.notifiedAt = t; changed = true;
        notify(s.toUser, 'surprises', 'A surprise just unlocked. Open it when you\'re ready.', { surpriseId: s.id });
        rt.broadcastCouple(s.coupleId, { t: 'surprise:unlocked', id: s.id, toUser: s.toUser });
      }
    }
    if (changed) save();
  }, 15_000).unref();
}
