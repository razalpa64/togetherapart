import { ok, fail, clean, now, id } from '../lib/util.js';
import { T, one, save, byId } from '../lib/db.js';
import { planDate } from '../content/planner.js';

export const routes = [
  ['POST', /^\/api\/dates\/plan$/, async ({ res, body, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const plan = planDate({
      minutes: body.minutes, mood: body.mood, energy: body.energy, notes: body.notes || '',
    });
    return ok(res, { plan });
  }],
  ['GET', /^\/api\/dates$/, async ({ res, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    return ok(res, { dates: T('dates').filter(d => d.coupleId === ctx.coupleId).sort((a, b) => b.createdAt - a.createdAt) });
  }],
  ['POST', /^\/api\/dates$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    if (!body.plan || !Array.isArray(body.plan.steps)) return fail(res, 400, 'That plan didn\'t come through.');
    const d = {
      id: id('d'), coupleId: ctx.coupleId,
      mood: clean(body.plan.mood, 20), duration: Number(body.plan.minutes) || 45,
      plan: JSON.stringify({ ...body.plan, steps: body.plan.steps.slice(0, 12) }),
      status: 'saved', currentStep: -1, startedAt: null, endedAt: null, saved: 1,
      createdBy: user.id, createdAt: now(),
    };
    T('dates').push(d);
    save();
    ctx.entity('new', 'dates', d);
    return ok(res, { date: d });
  }],
  ['POST', /^\/api\/dates\/([\w:-]+)\/start$/, async ({ res, params, user, ctx }) => {
    const d = byId('dates', params[0]);
    if (!d || d.coupleId !== ctx.coupleId) return fail(res, 404, 'That date isn\'t here anymore.');
    d.status = 'active'; d.currentStep = 0; d.startedAt = now(); d.endedAt = null;
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'date:event', id: d.id, type: 'started', date: d });
    if (ctx.partner) ctx.notify(ctx.partner.userId, 'dates', `${user.name} started your date — “${JSON.parse(d.plan).title}”. It\'s on.`, { dateId: d.id });
    return ok(res, { date: d });
  }],
  ['POST', /^\/api\/dates\/([\w:-]+)\/advance$/, async ({ res, body, params, user, ctx }) => {
    const d = byId('dates', params[0]);
    if (!d || d.coupleId !== ctx.coupleId) return fail(res, 404, 'That date isn\'t here anymore.');
    if (d.status !== 'active') return fail(res, 400, 'This date isn\'t running.');
    const plan = JSON.parse(d.plan);
    const dir = body.dir === -1 ? -1 : 1;
    d.currentStep = Math.min(Math.max(d.currentStep + dir, 0), plan.steps.length - 1);
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'date:event', id: d.id, type: 'step', date: d, by: user.id });
    return ok(res, { date: d });
  }],
  ['POST', /^\/api\/dates\/([\w:-]+)\/finish$/, async ({ res, body, params, user, ctx }) => {
    const d = byId('dates', params[0]);
    if (!d || d.coupleId !== ctx.coupleId) return fail(res, 404, 'That date isn\'t here anymore.');
    d.status = 'done'; d.endedAt = now();
    let memory = null;
    if (body.memory) {
      const plan = JSON.parse(d.plan);
      memory = {
        id: id('mem'), coupleId: ctx.coupleId, author: user.id, type: 'date',
        title: plan.title || 'A date', body: plan.steps.map(s => s.title).join(' · '),
        media: null, happenedOn: new Date().toISOString().slice(0, 10),
        songTitle: null, songArtist: null, pinned: 0, createdAt: now(),
      };
      T('memories').push(memory);
      ctx.entity('new', 'memories', memory);
    }
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'date:event', id: d.id, type: 'ended', date: d, memory });
    return ok(res, { date: d, memory });
  }],
  ['DELETE', /^\/api\/dates\/([\w:-]+)$/, async ({ res, params, ctx }) => {
    const d = byId('dates', params[0]);
    if (!d || d.coupleId !== ctx.coupleId) return fail(res, 404, 'That date isn\'t here anymore.');
    T('dates').splice(T('dates').indexOf(d), 1);
    save();
    ctx.entity('delete', 'dates', { id: d.id });
    return ok(res, { ok: true });
  }],
];
