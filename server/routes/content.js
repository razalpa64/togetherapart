import { ok, fail, clean, now, id } from '../lib/util.js';
import { T, one, save, byId } from '../lib/db.js';

const canSee = (item, coupleId) => item.coupleId === coupleId;

// memories, milestones, places, songs, countdowns — one file, five small resources.
export const routes = [
  // ---- memories ----
  ['GET', /^\/api\/memories$/, async ({ res, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const list = T('memories').filter(m => m.coupleId === ctx.coupleId).sort((a, b) => (b.happenedOn || '').localeCompare(a.happenedOn || ''));
    return ok(res, { memories: list });
  }],
  ['POST', /^\/api\/memories$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const type = ['photo', 'note', 'voice', 'song', 'milestone', 'date'].includes(body.type) ? body.type : 'note';
    if (type === 'photo' && body.media && !one('media', m => m.id === body.media)) return fail(res, 400, 'That upload didn\'t come through.');
    const m = {
      id: id('mem'), coupleId: ctx.coupleId, author: user.id, type,
      title: clean(body.title, 120) || 'A memory',
      body: clean(body.body, 2000),
      media: body.media && (one('media', x => x.id === body.media) || String(body.media).startsWith('demo:')) ? body.media : null,
      happenedOn: /^\d{4}-\d{2}-\d{2}$/.test(body.happenedOn || '') ? body.happenedOn : new Date().toISOString().slice(0, 10),
      songTitle: clean(body.songTitle, 120) || null, songArtist: clean(body.songArtist, 120) || null,
      pinned: body.pinned ? 1 : 0, createdAt: now(),
    };
    T('memories').push(m);
    save();
    ctx.entity('new', 'memories', m);
    if (ctx.partner) ctx.notify(ctx.partner.userId, 'memories', `${user.name} saved a memory: “${m.title}”`, { memoryId: m.id });
    return ok(res, { memory: m });
  }],
  ['PATCH', /^\/api\/memories\/([\w:-]+)$/, async ({ res, body, params, ctx }) => {
    const m = byId('memories', params[0]);
    if (!m || !canSee(m, ctx.coupleId)) return fail(res, 404, 'That memory is gone.');
    if (typeof body.title === 'string') m.title = clean(body.title, 120) || m.title;
    if (typeof body.body === 'string') m.body = clean(body.body, 2000);
    if (/^\d{4}-\d{2}-\d{2}$/.test(body.happenedOn || '')) m.happenedOn = body.happenedOn;
    if (typeof body.pinned === 'boolean') m.pinned = body.pinned ? 1 : 0;
    if (typeof body.songTitle === 'string') m.songTitle = clean(body.songTitle, 120);
    if (typeof body.songArtist === 'string') m.songArtist = clean(body.songArtist, 120);
    save();
    ctx.entity('update', 'memories', m);
    return ok(res, { memory: m });
  }],
  ['DELETE', /^\/api\/memories\/([\w:-]+)$/, async ({ res, params, ctx }) => {
    const m = byId('memories', params[0]);
    if (!m || !canSee(m, ctx.coupleId)) return fail(res, 404, 'That memory is gone.');
    T('memories').splice(T('memories').indexOf(m), 1);
    save();
    ctx.entity('delete', 'memories', { id: m.id });
    return ok(res, { ok: true });
  }],

  // ---- milestones / our story ----
  ['GET', /^\/api\/milestones$/, async ({ res, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    return ok(res, { milestones: T('milestones').filter(m => m.coupleId === ctx.coupleId).sort((a, b) => a.date.localeCompare(b.date)) });
  }],
  ['POST', /^\/api\/milestones$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const m = {
      id: id('ms'), coupleId: ctx.coupleId,
      date: /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : new Date().toISOString().slice(0, 10),
      title: clean(body.title, 120) || 'A moment', note: clean(body.note, 500),
      icon: clean(body.icon, 4) || '❤️', createdAt: now(),
    };
    T('milestones').push(m);
    save();
    ctx.entity('new', 'milestones', m);
    if (ctx.partner) ctx.notify(ctx.partner.userId, 'memories', `${user.name} added to your story: “${m.title}”`, { milestoneId: m.id });
    return ok(res, { milestone: m });
  }],
  ['PATCH', /^\/api\/milestones\/([\w:-]+)$/, async ({ res, body, params, ctx }) => {
    const m = byId('milestones', params[0]);
    if (!m || !canSee(m, ctx.coupleId)) return fail(res, 404, 'Not found.');
    if (typeof body.title === 'string') m.title = clean(body.title, 120) || m.title;
    if (typeof body.note === 'string') m.note = clean(body.note, 500);
    if (/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) m.date = body.date;
    if (typeof body.icon === 'string') m.icon = clean(body.icon, 4);
    save();
    ctx.entity('update', 'milestones', m);
    return ok(res, { milestone: m });
  }],
  ['DELETE', /^\/api\/milestones\/([\w:-]+)$/, async ({ res, params, ctx }) => {
    const m = byId('milestones', params[0]);
    if (!m || !canSee(m, ctx.coupleId)) return fail(res, 404, 'Not found.');
    T('milestones').splice(T('milestones').indexOf(m), 1);
    save();
    ctx.entity('delete', 'milestones', { id: m.id });
    return ok(res, { ok: true });
  }],

  // ---- places we'll go ----
  ['GET', /^\/api\/places$/, async ({ res, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    return ok(res, { places: T('places').filter(p => p.coupleId === ctx.coupleId).sort((a, b) => a.createdAt - b.createdAt) });
  }],
  ['POST', /^\/api\/places$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const p = {
      id: id('p'), coupleId: ctx.coupleId,
      name: clean(body.name, 80) || 'Somewhere', country: clean(body.country, 60),
      image: body.image && (String(body.image).startsWith('demo:') || one('media', x => x.id === body.image)) ? body.image : null,
      status: ['dreaming', 'planned', 'visited'].includes(body.status) ? body.status : 'dreaming',
      note: clean(body.note, 500), dreamDate: clean(body.dreamDate, 500),
      targetOn: /^\d{4}-\d{2}-\d{2}$/.test(body.targetOn || '') ? body.targetOn : null,
      checklist: JSON.stringify(Array.isArray(body.checklist) ? body.checklist.slice(0, 30).map(c => ({ t: clean(c.t, 120), done: !!c.done })) : []),
      visitedOn: null, createdAt: now(),
    };
    T('places').push(p);
    save();
    ctx.entity('new', 'places', p);
    if (ctx.partner) ctx.notify(ctx.partner.userId, 'memories', `${user.name} added ${p.name} to your places.`);
    return ok(res, { place: p });
  }],
  ['PATCH', /^\/api\/places\/([\w:-]+)$/, async ({ res, body, params, user, ctx }) => {
    const p = byId('places', params[0]);
    if (!p || !canSee(p, ctx.coupleId)) return fail(res, 404, 'Not found.');
    for (const f of ['name', 'country', 'note', 'dreamDate']) if (typeof body[f] === 'string') p[f] = clean(body[f], f === 'note' || f === 'dreamDate' ? 500 : 80);
    if (['dreaming', 'planned', 'visited'].includes(body.status)) {
      p.status = body.status;
      if (body.status === 'visited' && !p.visitedOn) p.visitedOn = new Date().toISOString().slice(0, 10);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(body.targetOn || '')) p.targetOn = body.targetOn;
    if (Array.isArray(body.checklist)) p.checklist = JSON.stringify(body.checklist.slice(0, 30).map(c => ({ t: clean(c.t, 120), done: !!c.done })));
    save();
    ctx.entity('update', 'places', p);
    return ok(res, { place: p });
  }],
  ['DELETE', /^\/api\/places\/([\w:-]+)$/, async ({ res, params, ctx }) => {
    const p = byId('places', params[0]);
    if (!p || !canSee(p, ctx.coupleId)) return fail(res, 404, 'Not found.');
    T('places').splice(T('places').indexOf(p), 1);
    save();
    ctx.entity('delete', 'places', { id: p.id });
    return ok(res, { ok: true });
  }],

  // ---- our songs ----
  ['GET', /^\/api\/songs$/, async ({ res, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    return ok(res, { songs: T('songs').filter(s => s.coupleId === ctx.coupleId).sort((a, b) => a.position - b.position || a.createdAt - b.createdAt) });
  }],
  ['POST', /^\/api\/songs$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const s = {
      id: id('s'), coupleId: ctx.coupleId,
      title: clean(body.title, 120) || 'Untitled', artist: clean(body.artist, 120),
      link: /^https?:\/\//.test(body.link || '') ? clean(body.link, 500) : null,
      note: clean(body.note, 300), addedBy: user.id,
      favorite: 0, month: 0, position: T('songs').filter(x => x.coupleId === ctx.coupleId).length, createdAt: now(),
    };
    T('songs').push(s);
    save();
    ctx.entity('new', 'songs', s);
    if (ctx.partner) ctx.notify(ctx.partner.userId, 'memories', `${user.name} added “${s.title}” to your songs.`);
    return ok(res, { song: s });
  }],
  ['PATCH', /^\/api\/songs\/([\w:-]+)$/, async ({ res, body, params, ctx }) => {
    const s = byId('songs', params[0]);
    if (!s || s.coupleId !== ctx.coupleId) return fail(res, 404, 'Not found.');
    if (typeof body.favorite === 'boolean') s.favorite = body.favorite ? 1 : 0;
    if (body.month) {
      for (const x of T('songs')) if (x.coupleId === ctx.coupleId) x.month = 0;
      s.month = 1;
    } else if (body.month === false) s.month = 0;
    if (typeof body.note === 'string') s.note = clean(body.note, 300);
    if (typeof body.link === 'string') s.link = /^https?:\/\//.test(body.link) ? clean(body.link, 500) : null;
    if (body.move === 'up' || body.move === 'down') {
      const list = T('songs').filter(x => x.coupleId === ctx.coupleId).sort((a, b) => a.position - b.position);
      const i = list.indexOf(s);
      const j = body.move === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < list.length) { const tmp = list[j].position; list[j].position = s.position; s.position = tmp; }
    }
    save();
    ctx.entity('update', 'songs', s);
    return ok(res, { song: s });
  }],
  ['DELETE', /^\/api\/songs\/([\w:-]+)$/, async ({ res, params, ctx }) => {
    const s = byId('songs', params[0]);
    if (!s || s.coupleId !== ctx.coupleId) return fail(res, 404, 'Not found.');
    T('songs').splice(T('songs').indexOf(s), 1);
    save();
    ctx.entity('delete', 'songs', { id: s.id });
    return ok(res, { ok: true });
  }],

  // ---- countdowns ----
  ['GET', /^\/api\/countdowns$/, async ({ res, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    return ok(res, { countdowns: T('countdowns').filter(c => c.coupleId === ctx.coupleId).sort((a, b) => a.targetAt - b.targetAt) });
  }],
  ['POST', /^\/api\/countdowns$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const targetAt = Number(body.targetAt);
    if (!targetAt || targetAt < now() || targetAt > now() + 10 * 365 * 86400000) return fail(res, 400, 'Pick a date in the future.');
    const c = { id: id('cd'), coupleId: ctx.coupleId, label: clean(body.label, 120) || 'until we meet again', targetAt: Math.floor(targetAt), icon: clean(body.icon, 4) || '✈️', createdBy: user.id, createdAt: now() };
    T('countdowns').push(c);
    save();
    ctx.entity('new', 'countdowns', c);
    return ok(res, { countdown: c });
  }],
  ['DELETE', /^\/api\/countdowns\/([\w:-]+)$/, async ({ res, params, ctx }) => {
    const c = byId('countdowns', params[0]);
    if (!c || c.coupleId !== ctx.coupleId) return fail(res, 404, 'Not found.');
    T('countdowns').splice(T('countdowns').indexOf(c), 1);
    save();
    ctx.entity('delete', 'countdowns', { id: c.id });
    return ok(res, { ok: true });
  }],
];
