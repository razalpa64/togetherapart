// Shared side-effect helpers: notifications + entity change broadcasts.
import { T, save, db } from './db.js';
import { id, now } from './util.js';

const PREF_KEYS = ['messages', 'surprises', 'dates', 'memories', 'moods', 'presence'];

export function makeEvents(rt) {
  const notify = (userId, type, body, data = {}) => {
    if (!userId) return;
    const prefs = db().notifPrefs[userId] || {};
    const silent = prefs[type] === false;
    const n = { id: id('n'), userId, type, body, data, readAt: null, createdAt: now(), silent };
    const list = T('notifications');
    list.push(n);
    const mine = list.filter(x => x.userId === userId);
    if (mine.length > 150) {
      for (const extra of mine.slice(0, mine.length - 150)) {
        const i = list.indexOf(extra);
        if (i >= 0) list.splice(i, 1);
      }
    }
    save();
    rt.broadcastUser(userId, { t: 'notify', notification: n });
  };
  const entity = (verb, kind, item) => {
    // kind: memories | milestones | places | songs | countdowns | dates | couple
    if (!item?.coupleId) return;
    rt.broadcastCouple(item.coupleId, { t: 'entity', verb, kind, item });
  };
  return { notify, entity };
}
