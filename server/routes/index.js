// Router: resolves auth + couple context once, dispatches to route modules.
import { userForToken, tokenFromReq, publicUser } from '../lib/auth.js';
import { T, one, byId, db } from '../lib/db.js';
import { json, fail, readJson, now } from '../lib/util.js';
import { routes as authRoutes } from './auth.js';
import { routes as coupleRoutes } from './couple.js';
import { routes as chatRoutes } from './chat.js';
import { routes as contentRoutes } from './content.js';
import { routes as dateRoutes } from './dates.js';
import { routes as gameRoutes } from './games.js';
import { routes as miscRoutes } from './misc.js';
import { routes as surpriseRoutes } from './surprises.js';

const ALL = [
  ...authRoutes, ...coupleRoutes, ...chatRoutes, ...contentRoutes,
  ...dateRoutes, ...gameRoutes, ...surpriseRoutes, ...miscRoutes,
];
// Ensure exact static routes are matched before parameterized ones.
ALL.sort((a, b) => (b[1].source.includes('\\w') ? 0 : 1) - (a[1].source.includes('\\w') ? 0 : 1));

export async function handleApi(req, res, url, rt, events) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method === 'HEAD' ? 'GET' : req.method;

  let user = null;
  try { user = userForToken(tokenFromReq(req, url)); } catch {}

  const member = user ? one('members', m => m.userId === user.id) : null;
  const couple = member ? byId('couples', member.coupleId) : null;
  const partnerMember = couple ? one('members', m => m.coupleId === couple.id && m.userId !== user.id) : null;
  const partnerUser = partnerMember ? byId('users', partnerMember.userId) : null;

  const ctx = {
    rt, ...events,
    user, member, couple,
    coupleId: couple ? couple.id : null,
    partner: partnerMember && partnerUser ? { ...partnerMember, user: partnerUser, userId: partnerMember.userId } : null,
    snapshot() {
      const d = db();
      const partner = this.partner ? {
        id: partnerUser.id, name: partnerUser.name, avatar: partnerUser.avatar, tz: partnerUser.tz,
        displayName: partnerMember.displayName, accent: partnerMember.accent, hair: partnerMember.hair,
        mood: d.moods[partnerUser.id] || null, demo: !!partnerUser.demo,
      } : null;
      const unread = T('notifications').filter(n => n.userId === user.id && !n.readAt).length;
      return {
        user: { ...publicUser(user), member: this.member ? { displayName: this.member.displayName, accent: this.member.accent, hair: this.member.hair } : null },
        couple: couple ? { id: couple.id, name: couple.name, inviteCode: couple.inviteCode, anniversary: couple.anniversary, theme: couple.theme, plan: couple.plan, room: couple.room, demo: !!couple.demo, createdAt: couple.createdAt, members: T('members').filter(m => m.coupleId === couple.id).length } : null,
        partner, unread,
        demo: { isDemoUser: !!user.demo, coupleIsDemo: !!(couple && couple.demo) },
      };
    },
  };

  for (const [m, re, handler] of ALL) {
    if (m !== method) continue;
    const match = pathname.match(re);
    if (!match) continue;
    let body = {};
    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      try { body = await readJson(req); }
      catch (e) { return fail(res, 400, 'That request didn\'t come through. Try again?'); }
    }
    try {
      return await handler({ req, res, url, query: url.searchParams, params: match.slice(1), body, user: ctx.user, ctx, token: tokenFromReq(req, url) });
    } catch (e) {
      console.error('[api]', method, pathname, e);
      return fail(res, 500, 'Something went wrong on our side. Give it a moment and try again.');
    }
  }
  return fail(res, 404, 'Nothing lives at that address.');
}
