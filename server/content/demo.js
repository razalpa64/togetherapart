// Demo world seed — clearly labeled sample data so every corner of the product is explorable
// without a real partner. Real accounts never see or touch this data.
import crypto from 'node:crypto';
import { db, save, T } from '../lib/db.js';
import { id, now } from '../lib/util.js';
import { hashPassword } from '../lib/auth.js';

const DAY = 86400000;
const MIN = 60000;

export function seedDemo() {
  const d = db();
  if (d.meta.seededDemo) return;
  const t0 = now();
  const mk = (email, name, accent, hair) => {
    const { salt, hash } = hashPassword(crypto.randomBytes(18).toString('base64url'));
    const u = { id: id('u'), email, passSalt: salt, passHash: hash, name, avatar: null, tz: 'Asia/Kolkata', createdAt: t0 - 200 * DAY, demo: true };
    T('users').push(u);
    return u;
  };
  const aisha = mk('aisha@demo.togetherapart.app', 'Aisha', 'rose', 'long');
  const ravi = mk('ravi@demo.togetherapart.app', 'Ravi', 'amber', 'short');
  const couple = {
    id: id('c'), name: 'Aisha & Ravi', inviteCode: 'DEMO-0000',
    anniversary: '2026-02-14', theme: 'evening', plan: 'premium',
    room: { scene: 'living', window: 'dusk', lamp: true, stringLights: true, candle: true, music: null, volume: 0.5 },
    createdAt: t0 - 180 * DAY, demo: true,
  };
  T('couples').push(couple);
  T('members').push(
    { coupleId: couple.id, userId: aisha.id, displayName: 'Aisha', accent: 'rose', hair: 'long', joinedAt: t0 - 180 * DAY },
    { coupleId: couple.id, userId: ravi.id, displayName: 'Ravi', accent: 'amber', hair: 'short', joinedAt: t0 - 179 * DAY },
  );
  d.moods[aisha.id] = { mood: 'calm', updatedAt: t0 - 40 * MIN };
  d.moods[ravi.id] = { mood: 'good', updatedAt: t0 - 90 * MIN };

  const msg = (from, body, minsAgo, extra = {}) => T('messages').push({
    id: id('m'), coupleId: couple.id, sender: from, type: 'text', body, media: null, replyTo: null,
    createdAt: t0 - minsAgo * MIN, deleted: 0, ...extra,
  });
  msg(ravi.id, 'landing in 40 mins, call after?', 2400);
  msg(aisha.id, 'yes! i have so much to tell you today', 2398);
  msg(ravi.id, 'oh no what happened 👀', 2397);
  msg(aisha.id, 'nothing bad!! good things for once', 2395);
  msg(ravi.id, 'those are my favorite kind', 2390);
  msg(aisha.id, 'the cafe you sent me last week — i went today and sat there reading like it was our table', 1500);
  msg(ravi.id, 'you did not', 1498);
  msg(aisha.id, 'i did. two cups and everything ☕', 1497);
  msg(ravi.id, 'next time i\'m in that chair across from you', 1490);
  msg(aisha.id, '49 days 🕯️', 1488);
  msg(ravi.id, '48. who\'s counting', 1486, {});
  msg(aisha.id, 'sleep well, love. stay with me for a bit?', 120);
  msg(ravi.id, 'always. rain on?', 118);

  const mem = (author, type, title, body, daysAgo, extra = {}) => T('memories').push({
    id: id('mem'), coupleId: couple.id, author, type, title, body, media: null,
    happenedOn: new Date(t0 - daysAgo * DAY).toISOString().slice(0, 10),
    songTitle: null, songArtist: null, pinned: 0, createdAt: t0 - daysAgo * DAY, ...extra,
  });
  mem(ravi.id, 'milestone', 'First message', 'A reply to a story about train stations. The rest is history.', 213, { pinned: 1 });
  mem(aisha.id, 'milestone', 'First long call', 'Four hours. We said goodbye six times.', 205);
  mem(ravi.id, 'milestone', 'We became official', 'You asked. I said yes before you finished the sentence.', 195);
  mem(aisha.id, 'date', 'First virtual date', 'Rooftop date, 45 minutes, one candle each.', 149, { media: 'demo:stay-rooftop' });
  mem(aisha.id, 'photo', 'Our corner', 'The corner that feels like ours.', 96, { media: 'demo:hero-room', pinned: 1 });
  mem(ravi.id, 'song', 'Song of a rainy week', 'We played it on loop the whole monsoon.', 80, { songTitle: 'Wherever You Will Go', songArtist: 'The Calling', media: 'demo:stay-rain' });
  mem(aisha.id, 'note', 'A tiny thing', 'You fell asleep mid-sentence on call and I stayed anyway.', 61);
  mem(ravi.id, 'photo', 'Favorite memory', 'The sunset we watched on call, both of us silent.', 96, { media: 'demo:stay-beach' });

  const mile = (date, title, note, icon) => T('milestones').push({ id: id('ms'), coupleId: couple.id, date, title, note, icon, createdAt: t0 - 10 * DAY });
  mile('2026-02-14', 'First message', 'A story about train stations', '💬');
  mile('2026-02-22', 'First call', 'Four hours, six goodbyes', '📞');
  mile('2026-03-03', 'We became official', 'You said yes before I finished asking', '❤️');
  mile('2026-04-18', 'First virtual date', 'Rooftop, one candle each', '🌙');
  mile('2026-05-25', 'First surprise', 'A letter that unlocked at sunrise', '✉️');
  mile('2026-12-12', 'First real meeting', 'Airport arrivals, 11:40', '✈️');

  T('places').push(
    { id: id('p'), coupleId: couple.id, name: 'Paris', country: 'France', image: null, status: 'dreaming', note: 'Someday.', dreamDate: 'Rainy October, one umbrella, no plan.', targetOn: null, checklist: JSON.stringify([{ t: 'Stay in Montmartre', done: false }, { t: 'Eat falafel in the Marais', done: false }]), visitedOn: null, createdAt: t0 - 120 * DAY },
    { id: id('p'), coupleId: couple.id, name: 'Kyoto', country: 'Japan', image: null, status: 'planned', note: 'The autumn trip. It\'s happening.', dreamDate: 'Momiji season, 7 a.m. empty temples.', targetOn: new Date(t0 + 97 * DAY).toISOString().slice(0, 10), checklist: JSON.stringify([{ t: 'Book ryokan', done: true }, { t: 'Rail passes', done: true }, { t: 'Kaiseki night', done: false }]), visitedOn: null, createdAt: t0 - 90 * DAY },
    { id: id('p'), coupleId: couple.id, name: 'Santorini', country: 'Greece', image: null, status: 'dreaming', note: 'For an anniversary, maybe.', dreamDate: 'White walls, blue everything.', targetOn: null, checklist: JSON.stringify([]), visitedOn: null, createdAt: t0 - 60 * DAY },
  );

  const song = (title, artist, by, note, extra = {}) => T('songs').push({
    id: id('s'), coupleId: couple.id, title, artist, link: null, note, addedBy: by,
    favorite: 0, month: 0, position: 0, createdAt: t0 - 80 * DAY, ...extra,
  });
  song('Wherever You Will Go', 'The Calling', ravi.id, 'Our rainy-week song', { favorite: 1, month: 1 });
  song('Falling', 'Jorja Smith', aisha.id, 'You hummed this on call once');
  song('Sunroof', 'Nicky Youre', ravi.id, 'Morning-walk energy');
  song('La Vie En Rose', 'Louis Armstrong', aisha.id, 'For Paris, eventually', { favorite: 1 });
  song('Tum Se Hi', 'Mohit Chauhan', ravi.id, 'The one from the wedding we crashed on video');
  song('Ocean Eyes', 'Billie Eilish', aisha.id, '3 a.m. version of us');

  T('countdowns').push(
    { id: id('cd'), coupleId: couple.id, label: 'until we see each other', targetAt: t0 + 42 * DAY, icon: '✈️', createdBy: ravi.id, createdAt: t0 - 10 * DAY },
    { id: id('cd'), coupleId: couple.id, label: 'until our anniversary', targetAt: t0 + 152 * DAY, icon: '❤️', createdBy: aisha.id, createdAt: t0 - 30 * DAY },
  );

  T('surprises').push(
    { id: id('x'), coupleId: couple.id, fromUser: ravi.id, toUser: aisha.id, type: 'letter', payload: JSON.stringify({ title: 'For a hard week', body: 'I know this week was heavy. I can\'t be there in the morning, so this is me trying anyway. You carried so much — I saw it, even through a screen. Rest tonight. Everything you\'re worried about is smaller than it looks at 2 a.m. I\'m proud of you. — R' }), unlockAt: t0 - 3 * DAY, openedAt: t0 - 3 * DAY + 3600000, createdAt: t0 - 5 * DAY },
    { id: id('x'), coupleId: couple.id, fromUser: aisha.id, toUser: ravi.id, type: 'gift', payload: JSON.stringify({ title: 'A small thing', gift: '🎧', note: 'For the nights you can\'t sleep. One song, eyes closed, think of the cafe.' }), unlockAt: t0 + 2 * DAY, openedAt: null, createdAt: t0 - 1 * DAY },
  );

  T('dates').push({
    id: id('d'), coupleId: couple.id, mood: 'romantic', duration: 45,
    plan: JSON.stringify({ title: 'ROOFTOP DATE', mood: 'romantic', energy: 2, minutes: 45, env: 'balcony', steps: [
      { kind: 'arrive', icon: '🚪', title: 'Arrive at the rooftop', desc: 'Blankets on, city lights on.', minutes: 3, startMin: 0, time: '00 min' },
      { kind: 'song', icon: '🎵', title: 'Choose a song for each other', desc: 'No explaining. Just send it.', minutes: 10, startMin: 3, time: '03 min' },
      { kind: 'cards', icon: '💬', title: 'Conversation cards', deck: 'cards', count: 4, desc: 'Take turns. Follow the tangents.', minutes: 15, startMin: 13, time: '13 min' },
      { kind: 'photo', icon: '📷', title: 'Take a couple photo', desc: 'Three seconds, no redoing it.', minutes: 6, startMin: 28, time: '28 min' },
      { kind: 'sunset', icon: '🌇', title: 'Watch the sky', desc: 'Until the color goes.', minutes: 7, startMin: 34, time: '34 min' },
      { kind: 'gratitude', icon: '❤️', title: 'End with a gratitude message', desc: 'One thing. Say it, then write it.', minutes: 4, startMin: 41, time: '41 min' },
    ] }),
    status: 'done', currentStep: 6, startedAt: t0 - 149 * DAY, endedAt: t0 - 149 * DAY + 50 * MIN, saved: 1, createdBy: ravi.id, createdAt: t0 - 149 * DAY,
  });

  d.meta.seededDemo = true;
  d.meta.demoCoupleId = couple.id;
  d.meta.demoUsers = { aisha: aisha.id, ravi: ravi.id };
  save();
}
