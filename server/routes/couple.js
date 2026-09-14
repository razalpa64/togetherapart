import { ok, fail, readJson, clean, now, rate, id } from '../lib/util.js';
import { T, one, save, byId, remove } from '../lib/db.js';
import { publicUser } from '../lib/auth.js';

const CODE_WORDS = ['LUNA','HAVEN','EMBER','WILLOW','ORION','MIRA','JUNIPER','VESPER','SAFFRON','ATLAS','HAZEL','SOLACE','AURELIA','CINDER','MARLOW','INDIGO'];
function newCode() {
  for (let i = 0; i < 50; i++) {
    const c = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] + '-' + String(Math.floor(1000 + Math.random() * 9000));
    if (!one('couples', x => x.inviteCode === c)) return c;
  }
  return 'WORLD-' + Date.now().toString(36).toUpperCase();
}

export const routes = [
  ['POST', /^\/api\/couple$/, async ({ res, body, user, ctx }) => {
    if (!user) return fail(res, 401, 'Please sign in.');
    if (ctx.coupleId) return fail(res, 409, 'You\'re already in a world. Leave it from Settings before starting a new one.');
    const yourName = clean(body.yourName, 40);
    const partnerName = clean(body.partnerName, 40);
    if (!yourName) return fail(res, 400, 'What should we call you?');
    if (!partnerName) return fail(res, 400, 'What\'s your partner\'s name?');
    const couple = {
      id: id('c'), name: `${yourName} & ${partnerName}`, inviteCode: newCode(),
      anniversary: null, theme: 'evening', plan: 'free',
      room: { scene: 'living', window: 'auto', lamp: true, stringLights: true, candle: true, music: null, volume: 0.5 },
      createdAt: now(), demo: false,
    };
    T('couples').push(couple);
    let member = one('members', m => m.userId === user.id);
    if (member) { member.coupleId = couple.id; member.displayName = yourName; }
    else T('members').push({ coupleId: couple.id, userId: user.id, displayName: yourName, accent: 'rose', hair: 'short', joinedAt: now() });
    save();
    return ok(res, { couple, invite: couple.inviteCode });
  }],
  ['POST', /^\/api\/couple\/join$/, async ({ res, body, user, ctx }) => {
    if (!user) return fail(res, 401, 'Please sign in.');
    if (ctx.coupleId) return fail(res, 409, 'You\'re already in a world.');
    const code = clean(body.code, 20).toUpperCase().replace(/\s+/g, '');
    const couple = one('couples', c => c.inviteCode === code);
    if (!couple) return fail(res, 404, 'That code doesn\'t match any world. Check with your partner?');
    const members = T('members').filter(m => m.coupleId === couple.id);
    if (members.length >= 2) return fail(res, 409, 'That world is already full — it\'s built for two.');
    T('members').push({ coupleId: couple.id, userId: user.id, displayName: clean(user.name, 40) || 'Partner', accent: 'amber', hair: 'short', joinedAt: now() });
    save();
    ctx.rt.broadcastCouple(couple.id, { t: 'couple:joined', member: { userId: user.id, displayName: user.name } });
    ctx.notify(members[0].userId, 'presence', `${user.name} just walked in. You\'re together now.`);
    return ok(res, { couple });
  }],
  ['PATCH', /^\/api\/couple$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const c = ctx.couple;
    if (typeof body.name === 'string') c.name = clean(body.name, 60) || c.name;
    if (typeof body.anniversary === 'string') c.anniversary = /^\d{4}-\d{2}-\d{2}$/.test(body.anniversary) ? body.anniversary : c.anniversary;
    if (body.theme === 'morning' || body.theme === 'evening') c.theme = body.theme;
    if (body.plan === 'free' || body.plan === 'premium') c.plan = body.plan;
    if (body.room && typeof body.room === 'object') c.room = { ...c.room, ...body.room };
    save();
    ctx.entity('update', 'couple', { name: c.name, anniversary: c.anniversary, theme: c.theme, plan: c.plan, room: c.room });
    return ok(res, { couple: c });
  }],
  ['POST', /^\/api\/couple\/dissolve$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Nothing to leave.');
    if (ctx.couple.demo) return fail(res, 403, 'The demo world can\'t be dissolved.');
    if (clean(body.confirm, 40) !== 'goodbye') return fail(res, 400, 'Type "goodbye" to confirm — this removes your world forever.');
    const cid = ctx.coupleId;
    remove('members', m => m.coupleId === cid);
    remove('messages', m => m.coupleId === cid);
    remove('reactions', r => !byId('messages', r.messageId));
    remove('reads', r => !byId('messages', r.messageId));
    remove('memories', m => m.coupleId === cid);
    remove('milestones', m => m.coupleId === cid);
    remove('places', m => m.coupleId === cid);
    remove('songs', m => m.coupleId === cid);
    remove('countdowns', m => m.coupleId === cid);
    remove('surprises', m => m.coupleId === cid);
    remove('dates', m => m.coupleId === cid);
    remove('games', m => m.coupleId === cid);
    remove('couples', m => m.id === cid);
    save();
    return ok(res, { ok: true });
  }],
];
