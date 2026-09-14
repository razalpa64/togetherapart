import { api, getToken, clearToken } from './api.js';
import { emit } from './bus.js';

export const store = {
  me: null,        // {user, couple, partner, unread, demo}
  room: null,
  presence: {},    // partnerId -> presence
  moods: {},       // userId -> {mood}
  route: 'place',
};

export async function refreshMe() {
  if (!getToken()) { store.me = null; return null; }
  try {
    const d = await api('GET', '/api/me');
    store.me = d;
    store.room = d.couple?.room || null;
    applyTheme();
    return d;
  } catch (e) {
    if (e.status === 401) { store.me = null; clearToken(); }
    else throw e;
    return null;
  }
}

export function applyTheme() {
  const t = store.me?.couple?.theme === 'morning' ? 'morning' : 'evening';
  document.documentElement.dataset.theme = t;
}

export const amDemo = () => !!store.me?.demo?.isDemoUser;
export const coupleIsDemo = () => !!store.me?.demo?.coupleIsDemo;
export const partner = () => store.me?.partner || null;
export const isPremium = () => true; // 100% of premium features are free for all couples

