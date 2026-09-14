import { ok, fail, clean, now, rate, id } from '../lib/util.js';
import { T, one, save } from '../lib/db.js';

const senderOf = (uid) => {
  const u = one('users', x => x.id === uid);
  return u ? { id: u.id, name: u.name, avatar: u.avatar } : { id: uid, name: 'Someone', avatar: null };
};
const decorate = (m) => ({
  ...m,
  reactions: T('reactions').filter(r => r.messageId === m.id).map(r => ({ userId: r.userId, emoji: r.emoji })),
  reads: T('reads').filter(r => r.messageId === m.id).map(r => r.userId),
});

export const routes = [
  ['GET', /^\/api\/messages$/, async ({ res, query, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    let list = T('messages').filter(m => m.coupleId === ctx.coupleId);
    const before = query.get('before');
    if (before) {
      const b = one('messages', m => m.id === before);
      if (b) list = list.filter(m => m.createdAt < b.createdAt);
    }
    list = list.slice(-60);
    const q = (query.get('q') || '').toLowerCase();
    if (q) list = list.filter(m => (m.body || '').toLowerCase().includes(q));
    return ok(res, { messages: list.map(decorate) });
  }],
  ['POST', /^\/api\/messages$/, async ({ req, res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    if (!rate('msg:' + user.id, 90, 60_000)) return fail(res, 429, 'Easy — send that in a moment.');
    const type = ['text', 'image', 'voice'].includes(body.type) ? body.type : 'text';
    let text = clean(body.body, 4000);
    if (type === 'text' && !text) return fail(res, 400, 'Say something first.');
    if (type !== 'text' && !body.media) return fail(res, 400, 'That upload didn\'t come through. Try again?');
    if (body.media && !one('media', m => m.id === body.media)) return fail(res, 400, 'That upload didn\'t come through. Try again?');
    const m = {
      id: id('m'), coupleId: ctx.coupleId, sender: user.id, type,
      body: type === 'text' ? text : (type === 'image' ? clean(body.caption, 500) : ''),
      media: type === 'text' ? null : body.media,
      replyTo: body.replyTo && one('messages', x => x.id === body.replyTo) ? body.replyTo : null,
      createdAt: now(), deleted: 0,
    };
    T('messages').push(m);
    save();
    const out = decorate(m);
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'chat:message', message: out });
    if (ctx.partner) ctx.notify(ctx.partner.userId, 'messages', `${user.name}: ${type === 'text' ? text.slice(0, 80) : type === 'image' ? 'sent a photo' : 'sent a voice note'}`, { messageId: m.id });
    return ok(res, { message: out });
  }],
  ['POST', /^\/api\/messages\/read-all$/, async ({ res, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    let added = 0;
    for (const m of T('messages')) {
      if (m.coupleId !== ctx.coupleId || m.sender === user.id) continue;
      if (!one('reads', r => r.messageId === m.id && r.userId === user.id)) {
        T('reads').push({ messageId: m.id, userId: user.id, at: now() }); added++;
      }
    }
    if (added) save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'chat:read', userId: user.id, at: now() });
    return ok(res, { ok: true });
  }],
  ['POST', /^\/api\/messages\/([\w-]+)\/react$/, async ({ res, body, user, params, ctx }) => {
    const m = one('messages', x => x.id === params[0]);
    if (!m || m.coupleId !== ctx.coupleId) return fail(res, 404, 'That message is gone.');
    const emoji = body.emoji ? clean(body.emoji, 8) : null;
    const existing = one('reactions', r => r.messageId === m.id && r.userId === user.id);
    if (existing) {
      const i = T('reactions').indexOf(existing);
      if (!emoji || existing.emoji === emoji) { T('reactions').splice(i, 1); }
      else existing.emoji = emoji;
    } else if (emoji) T('reactions').push({ messageId: m.id, userId: user.id, emoji });
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'chat:react', messageId: m.id, reactions: T('reactions').filter(r => r.messageId === m.id).map(r => ({ userId: r.userId, emoji: r.emoji })) });
    return ok(res, { ok: true });
  }],
  ['DELETE', /^\/api\/messages\/([\w-]+)$/, async ({ res, user, params, ctx }) => {
    const m = one('messages', x => x.id === params[0]);
    if (!m || m.coupleId !== ctx.coupleId || m.sender !== user.id) return fail(res, 404, 'That message is gone.');
    m.deleted = 1; m.body = ''; m.media = null; m.type = 'text';
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'chat:delete', id: m.id });
    return ok(res, { ok: true });
  }],
  ['GET', /^\/api\/messages\/search$/, async ({ res, query, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const q = (query.get('q') || '').toLowerCase().trim();
    if (!q) return ok(res, { messages: [] });
    const list = T('messages').filter(m => m.coupleId === ctx.coupleId && !m.deleted && (m.body || '').toLowerCase().includes(q)).slice(-30);
    return ok(res, { messages: list.map(decorate) });
  }],
];
