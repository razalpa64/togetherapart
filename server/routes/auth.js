import { signup, login, createSession, destroySession, createReset, consumeReset, publicUser } from '../lib/auth.js';
import { ok, fail, readJson, rate, clean, isEmail, getIp } from '../lib/util.js';
import { one, save, T, byId } from '../lib/db.js';
import { now } from '../lib/util.js';

export const routes = [
  ['POST', /^\/api\/auth\/signup$/, async ({ req, res, body }) => {
    const ip = getIp(req);
    if (!rate('signup:' + ip, 60, 60_000)) return fail(res, 429, 'Too many tries just now. Give it a minute.');
    try {
      const user = signup(body);
      const token = createSession(user.id);
      return ok(res, { token, user: publicUser(user) });
    } catch (e) { return fail(res, 400, e.message); }
  }],
  ['POST', /^\/api\/auth\/login$/, async ({ req, res, body }) => {
    const ip = getIp(req);
    if (!rate('login:' + ip, 60, 60_000)) return fail(res, 429, 'Too many tries just now. Give it a minute.');
    try {
      const user = login(body.email, body.password);
      const token = createSession(user.id);
      return ok(res, { token, user: publicUser(user) });
    } catch (e) { return fail(res, 401, e.message); }
  }],
  ['POST', /^\/api\/auth\/logout$/, async ({ res, token }) => {
    if (token) destroySession(token);
    return ok(res, { ok: true });
  }],
  ['POST', /^\/api\/auth\/reset-request$/, async ({ req, res, body }) => {
    const ip = getIp(req);
    if (!rate('reset:' + ip, 30, 60_000)) return fail(res, 429, 'Too many tries just now. Give it a minute.');
    const token = createReset(body.email || '');
    // No mail provider is wired in this build — the link is returned so the flow is testable.
    return ok(res, { ok: true, demo: true, resetUrl: token ? '/app#/reset?token=' + token : null,
      message: token ? 'No email service is connected in this demo, so here is the reset link directly.' : 'If that email exists, a reset link is on its way.' });
  }],
  ['POST', /^\/api\/auth\/reset$/, async ({ req, res, body }) => {
    try { consumeReset(body.token || '', body.password || ''); return ok(res, { ok: true }); }
    catch (e) { return fail(res, 400, e.message); }
  }],
  ['POST', /^\/api\/demo\/login$/, async ({ res, body }) => {
    const d = (await import('../lib/db.js')).db();
    const ids = d.meta.demoUsers || {};
    const uid = ids[body.side];
    if (!uid) return fail(res, 404, 'The demo world isn\'t available.');
    const token = createSession(uid);
    const user = byId('users', uid);
    return ok(res, { token, user: publicUser(user) });
  }],
  ['GET', /^\/api\/me$/, async ({ res, user, ctx }) => {
    if (!user) return fail(res, 401, 'Please sign in.');
    return ok(res, ctx.snapshot());
  }],
];
