// App bootstrap: session, shell, router, realtime wiring, notifications, presence.
import { getToken, setToken, clearToken, api } from './api.js';
import { store, refreshMe, applyTheme, partner, coupleIsDemo, amDemo } from './state.js';
import { connect, send, disconnect } from './ws.js';
import { on, emit } from './bus.js';
import { h, icon, toast, showMenu, avatarEl, fmtCountdown, timeAgo } from './ui.js';
import { initRtc } from './rtc.js';
import { stop, playing, getVolume, setVolume } from './audio.js';

const NAV = [
  { id: 'place', label: 'Our Place', icon: 'home' },
  { id: 'date', label: 'Date Night', icon: 'sparkle' },
  { id: 'games', label: 'Games Arcade', icon: 'gamepad' },
  { id: 'activities', label: 'Activities', icon: 'grid' },
  { id: 'memories', label: 'Memories', icon: 'image' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
];
const NAV2 = [
  { id: 'story', label: 'Our Story', icon: 'book' },
  { id: 'places', label: 'Places', icon: 'pin' },
  { id: 'songs', label: 'Our Songs', icon: 'music' },
  { id: 'surprises', label: 'Surprises', icon: 'gift' },
  { id: 'bouquet', label: 'Digital Bouquet', icon: 'heart' },
  { id: 'booth', label: 'Photo Booth', icon: 'camera' },
  { id: 'premium', label: 'Premium', icon: 'crown' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

let currentView = null;
let notifPanel = null;
let nextCountdown = null;

/* ---------------- boot ---------------- */
let backend = null; // active when running on Supabase (window.__TA_ENV__ configured)
async function initBackend() {
  const env = window.__TA_ENV__;
  if (!env || !env.supabaseUrl || !env.supabaseAnonKey) return; // self-hosted Node server
  backend = await import('./backend/supabase.js');
  await backend.initSupabase(env);
}

async function boot() {
  const app = document.getElementById('app');
  try {
    await initBackend();
    if (!getToken()) { return renderAuth(app); }
    try { await refreshMe(); }
    catch (e) {
      clearToken();
      toast(e.message || 'Session expired. Please sign in again.');
      return renderAuth(app);
    }
    if (!store.me) return renderAuth(app);
    applyTheme();
    if (window.__TA_RECOVERY__) { // landed from a password-reset email (supabase mode)
      window.__TA_RECOVERY__ = false;
      try { history.replaceState(null, '', location.pathname + '#/reset'); } catch {}
      return renderAuth(app, new URLSearchParams('mode=reset&recovery=1'));
    }
    if (!store.me.couple) return renderOnboarding(app);
    buildShell(app);
  } catch (e) {
    console.error(e);
    app.replaceChildren();
    app.append(h('div', { class: 'boot' },
      h('h1', { class: 'display-2' }, 'Something interrupted us.'),
      h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'The page hit an unexpected snag. Trying again or resetting your session fixes it.'),
      h('div', { style: { display: 'flex', gap: '10px', marginTop: '14px', justifyContent: 'center' } },
        h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Try again'),
        h('button', { class: 'btn btn-ghost', onclick: () => { clearToken(); location.hash = ''; location.reload(); } }, 'Reset & Sign In'))));
  }
}

/* ---------------- auth / onboarding entry ---------------- */
async function renderAuth(app, overrideParams) {
  const { render } = await import('./views/auth.js');
  app.replaceChildren();
  app.append(render(app, overrideParams || new URLSearchParams(location.hash.split('?')[1] || ''), afterAuth));
}
async function renderOnboarding(app) {
  const { render } = await import('./views/onboarding.js');
  app.replaceChildren();
  app.append(render(afterOnboarding));
}
async function afterAuth() { await boot(); }
async function afterOnboarding() { await boot(); }

/* ---------------- shell ---------------- */
function buildShell(app) {
  disconnect();
  app.replaceChildren();
  const view = h('main', { id: 'view', class: 'view', tabindex: '-1' });
  const me = store.me;

  const rail = h('aside', { class: 'rail', 'aria-label': 'Primary' },
    h('a', { class: 'wordmark', href: '#/place' }, 'Together, ', h('em', {}, 'Apart')),
    h('div', { class: 'nav-sec' },
      h('span', { class: 'tag', style: { padding: '0 10px' } }, 'Yours'),
      ...NAV.map(n => railLink(n))),
    h('div', { class: 'nav-sec' },
      h('span', { class: 'tag', style: { padding: '0 10px' } }, 'More'),
      ...NAV2.map(n => railLink(n))),
    h('div', { class: 'rail-foot' },
      me.couple.members < 2
        ? h('button', { class: 'plan-chip', onclick: () => showInvite(), style: { cursor: 'pointer', width: '100%' } }, h('span', { html: icon('users', 16) }), h('span', {}, 'Invite your partner'))
        : h('a', { class: 'plan-chip', href: '#/premium' }, h('span', { html: icon('crown', 16) }), h('span', {}, me.couple.plan === 'premium' ? 'Premium' : 'Free plan'))));

  const tbTitle = h('div', { class: 'tb-title' },
    h('span', { class: 'n' }, me.couple.name),
    h('span', { class: 's', id: 'tb-sub' }, '\u00a0'));
  const cdChip = h('button', { class: 'cd-chip', id: 'tb-cd', 'aria-label': 'Next countdown', onclick: () => { location.hash = '#/place'; } });
  const soundBtn = h('button', { class: 'icon-btn', id: 'tb-sound', 'aria-label': 'Stop ambient sound', html: icon('volume', 19), onclick: toggleSound });
  const bellBtn = h('button', { class: 'icon-btn', id: 'tb-bell', 'aria-label': 'Notifications', html: icon('bell', 19), onclick: toggleNotifPanel });
  const meBtn = h('button', { class: 'tb-me', 'aria-label': 'Account menu', style: { background: 'none' }, onclick: (e) => accountMenu(e.currentTarget) }, avatarEl({ ...me.user.member, name: me.user.name, avatar: me.user.avatar }, 34));

  const topbar = h('header', { class: 'topbar' }, tbTitle,
    h('div', { class: 'tb-right' }, cdChip, soundBtn, bellBtn, meBtn));

  const bottomnav = h('nav', { class: 'bottomnav', 'aria-label': 'Primary' },
    ...NAV.map(n => h('a', { href: '#/' + n.id, dataset: { nav: n.id } }, h('span', { html: icon(n.icon, 21) }), h('span', {}, n.label))),
  );

  const shell = h('div', { class: 'shell' }, rail, h('div', { class: 'main' }, topbar, view), bottomnav);
  app.append(shell);
  if (coupleIsDemo() || amDemo()) app.append(demoBar());

  // realtime
  connect();
  initRtc();
  wireEvents();
  refreshCountdown();
  refreshSubline();
  navigate();
  document.title = me.couple.name + ' — Together, Apart';
}

function railLink(n) {
  return h('a', { href: '#/' + n.id, dataset: { nav: n.id } }, h('span', { html: icon(n.icon, 19) }), h('span', {}, n.label));
}

export async function performSignOut() {
  try { await api('POST', '/api/auth/logout'); } catch {}
  clearToken();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
  store.me = null;
  store.room = null;
  document.body.classList.remove('has-demo-bar');
  const d = document.querySelector('.demo-bar');
  if (d) d.remove();
  location.href = location.origin + location.pathname + '#/auth';
  location.reload();
}

function demoBar() {
  document.body.classList.add('has-demo-bar');
  const swap = async () => {
    const d = await api('POST', '/api/demo/login', { side: amDemo() && store.me.user.name === 'Aisha' ? 'ravi' : 'aisha' });
    setToken(d.token); location.reload();
  };
  return h('div', { class: 'demo-bar' },
    h('span', {}, '🌿 You\'re exploring the ', h('b', {}, 'demo world'), ' — sample data, not a real couple.'),
    h('button', { onclick: swap }, 'View as the other partner'),
    h('button', { onclick: performSignOut }, 'Exit demo world'));
}

/* ---------------- routing ---------------- */
const VIEWS = ['place', 'date', 'games', 'activities', 'memories', 'chat', 'story', 'places', 'songs', 'surprises', 'bouquet', 'booth', 'settings', 'premium'];
window.addEventListener('hashchange', () => navigate());
async function navigate() {
  const app = document.getElementById('app');
  if (!app.querySelector('.shell')) return;
  const hash = location.hash.replace(/^#\/?/, '');
  const [path, qs] = hash.split('?');
  const params = new URLSearchParams(qs || '');
  let name = path || 'place';
  if (!VIEWS.includes(name)) name = 'place';
  store.route = name;
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try {
    const mod = await import('./views/' + name + '.js');
    const root = document.getElementById('view');
    if (currentView && typeof currentView.destroy === 'function') currentView.destroy();
    root.replaceChildren();
    root.className = 'view' + (name === 'place' ? ' full' : '');
    currentView = mod.render(root, params) || null;
    root.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    toast('That page didn\'t load. Try again?');
  }
}

/* ---------------- global realtime wiring ---------------- */
function wireEvents() {
  let wired = window.__taWired;
  if (wired) return;
  window.__taWired = true;

  on('ws:hello', (m) => { mergePresence(m.presence); });
  on('ws:presence', (m) => { mergePresence(m.presence); refreshSubline(); emit('presence', m.presence); });

  on('ws:notify', ({ notification }) => {
    if (!notification || notification.silent) { if (notification) { store.unread++; updateBell(); } return; }
    store.unread++;
    updateBell();
    const isMsg = ['messages'].includes(notification.type);
    toast(notification.body, isMsg && store.route !== 'chat' ? { actionLabel: 'Open', onAction: () => { location.hash = '#/chat'; } } : {});
    refreshNotifPanel();
  });

  on('ws:chat:message', ({ message }) => {
    if (store.route !== 'chat' && message.sender !== store.me.user.id) {
      const name = message.sender === store.partner()?.userId ? (store.partner().displayName || 'They') : 'You';
      if (message.type === 'text') toast(name + ': ' + message.body.slice(0, 90));
      else toast(name + ' sent ' + (message.type === 'image' ? 'a photo' : 'a voice note'));
    }
    emit('chat', message);
  });

  on('ws:entity', ({ verb, kind, item }) => {
    emit('entity:' + kind, { verb, item });
    if (kind === 'countdowns') refreshCountdown();
    if (kind === 'couple') { refreshMe().then(() => { applyTheme(); }); }
  });

  on('ws:mood', ({ userId, mood }) => { store.moods[userId] = { mood }; emit('mood', { userId, mood }); });

  on('ws:interaction', ({ from, type }) => {
    if (from === store.me.user.id) return;
    const label = {
      wave: 'waved at you 👋', hug: 'is hugging you 🤗', hands: 'took your hand 🤝',
      highfive: 'high-fived you ✋', fistbump: 'fist-bumped you 👊', heart: 'sent you a heart ❤️',
      flower: 'sent you a flower 🌷', headpat: 'patted your head', dance: 'started dancing 💃', pat: 'patted your head',
    }[type] || 'sent you something';
    toast((store.partner()?.displayName || 'They') + ' ' + label, { dur: 3200 });
  });

  on('ws:float', ({ from, emoji }) => { if (from !== store.me.user.id) import('./ui.js').then(m => m.floatEmoji(emoji)); });

  on('ws:stay', (m) => emit('stay', m));
  on('ws:game:state', (m) => emit('game:state', m));
  on('ws:date:event', (m) => emit('date:event', m));
  on('ws:chat:typing', (m) => emit('typing', m));
  on('ws:chat:react', (m) => emit('chat:react', m));
  on('ws:chat:read', (m) => emit('chat:read', m));
  on('ws:chat:delete', (m) => emit('chat:delete', m));
  on('ws:room:patch', (m) => { if (m.by !== store.me.user.id) { store.room = { ...(store.room || {}), ...m.patch }; emit('room', m.patch); } });
  on('ws:avatar:move', (m) => emit('avatar:move', m));
  on('ws:profile', () => refreshMe().then(() => emit('profiles', {})));

  // connection banner
  on('ws:down', ({ retry }) => {
    if (retry < 1) return;
    let b = document.getElementById('conn-banner');
    if (!b) {
      b = h('div', { class: 'banner', id: 'conn-banner', role: 'status' }, h('span', { html: icon('wifioff', 16) }), 'Something interrupted your connection. We\'re trying again…');
      document.body.append(b);
    }
  });
  on('ws:up', () => { const b = document.getElementById('conn-banner'); if (b) b.remove(); });

  // presence heartbeat + auto-away
  let lastActivity = Date.now();
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true, capture: true }));
  setInterval(() => {
    const idle = Date.now() - lastActivity > 5 * 60_000;
    const hidden = document.visibilityState === 'hidden';
    send({ t: 'presence', state: idle || hidden ? 'away' : 'online', tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  }, 30_000);
  document.addEventListener('visibilitychange', () => {
    send({ t: 'presence', state: document.visibilityState === 'hidden' ? 'away' : 'online', tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  });
}

function mergePresence(presence) {
  if (!presence) return;
  store.presence = { ...store.presence, ...presence };
  refreshSubline();
  emit('presenceChanged', store.presence);
}

/* ---------------- topbar bits ---------------- */
function refreshSubline() {
  const el = document.getElementById('tb-sub');
  if (!el || !store.me) return;
  const p = partner();
  if (!p) { el.textContent = 'Waiting for your partner…'; return; }
  const pres = store.presence[p.userId];
  const online = pres?.online;
  let where = '';
  if (online) {
    where = pres.state === 'just_staying' ? 'just staying' : pres.state === 'away' ? 'away'
      : pres.activity ? pres.activity : pres.state || 'online';
  }
  let localTime = '';
  if (pres?.tz) {
    try { localTime = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit', timeZone: pres.tz }).format(new Date()) + ' their time'; } catch {}
  }
  el.textContent = online ? `${p.displayName} · ${where}${localTime ? ' · ' + localTime : ''}` : `${p.displayName} · away right now`;
  emit('subline', {});
}

async function refreshCountdown() {
  try {
    const d = await api('GET', '/api/countdowns');
    const future = d.countdowns.filter(c => c.targetAt > Date.now());
    nextCountdown = future[0] || null;
    const el = document.getElementById('tb-cd');
    if (el) {
      el.style.display = nextCountdown ? '' : 'none';
      if (nextCountdown) el.replaceChildren(h('span', {}, nextCountdown.icon || '✈️'), h('b', {}, fmtCountdown(nextCountdown.targetAt - Date.now())), h('span', { class: 'lbl' }, nextCountdown.label));
    }
  } catch {}
}

function toggleSound() {
  const btn = document.getElementById('tb-sound');
  if (playing()) { stop(); btn.innerHTML = icon('volumex', 19); btn.classList.remove('on'); }
  else {
    const last = storage.get('ta_last_amb') || 'rain';
    import('./audio.js').then(a => { a.play(last); storage.set('ta_last_amb', last); });
    btn.innerHTML = icon('volume', 19); btn.classList.add('on');
  }
  emit('audio', {});
}

function updateBell() {
  const btn = document.getElementById('tb-bell');
  if (!btn) return;
  btn.innerHTML = icon('bell', 19);
  if (store.unread > 0) btn.append(h('span', { class: 'badge' }, store.unread > 9 ? '9+' : String(store.unread)));
}

async function toggleNotifPanel() {
  if (notifPanel) { notifPanel.remove(); notifPanel = null; return; }
  const d = await api('GET', '/api/notifications').catch(() => null);
  if (!d) return;
  store.unread = d.unread; updateBell();
  const list = h('div', {}, d.notifications.length ? d.notifications.map(n => h('div', { class: 'notif' + (n.readAt ? '' : ' unread') },
    h('span', { class: 'e' }, notifEmoji(n.type)), h('div', {}, h('div', { class: 'b' }, n.body), h('div', { class: 't' }, timeAgo(n.createdAt))))) :
    h('div', { style: { padding: '30px 14px', textAlign: 'center' }, class: 'muted small' }, 'Nothing yet. When something happens, it lands here.'));
  notifPanel = h('div', { class: 'notif-panel', role: 'dialog', 'aria-label': 'Notifications' },
    h('div', { class: 'nh' }, h('b', {}, 'For you'), h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await api('POST', '/api/notifications/read', { all: true }); store.unread = 0; updateBell(); toggleNotifPanel(); toggleNotifPanel(); } }, 'Mark read')),
    list);
  document.body.append(notifPanel);
  setTimeout(() => {
    const off = (e) => { if (!notifPanel || notifPanel.contains(e.target)) return; notifPanel.remove(); notifPanel = null; document.removeEventListener('mousedown', off); };
    document.addEventListener('mousedown', off);
  }, 50);
}
function refreshNotifPanel() { if (notifPanel) { notifPanel.remove(); notifPanel = null; } }
function notifEmoji(type) { return { messages: '💬', surprises: '🎁', dates: '🌙', memories: '📸', moods: '🌤️', presence: '🚪' }[type] || '✨'; }

function accountMenu(anchor) {
  const me = store.me;
  showMenu([
    { icon: 'gear', label: 'Settings', onclick: () => { location.hash = '#/settings'; } },
    ...(me.couple.members < 2 ? [{ icon: 'users', label: 'Invite your partner', onclick: () => showInvite() }] : []),
    { icon: me.couple.theme === 'evening' ? 'sun' : 'moon', label: me.couple.theme === 'evening' ? 'Morning light' : 'Evening light', onclick: async () => { await api('PATCH', '/api/couple', { theme: me.couple.theme === 'evening' ? 'morning' : 'evening' }); await refreshMe(); applyTheme(); } },
    '-',
    { icon: 'logout', label: 'Sign out', onclick: performSignOut },
  ], anchor);
}

export function showInvite() {
  const code = store.me.couple.inviteCode;
  const link = location.origin + '/app#/auth?mode=join&code=' + code;
  import('./ui.js').then(async (UI) => {
    UI.modal({
      title: 'Invite your partner',
      body: h('div', {},
        h('p', { class: 'muted small', style: { marginBottom: '16px' } }, 'Your world is waiting. Share this code — they\'ll enter it when they create their account.'),
        h('div', { class: 'invite-box', style: { textAlign: 'center' } },
          h('div', { class: 'invite-code' }, code),
          h('div', { class: 'invite-row' },
            h('button', { class: 'btn btn-primary btn-sm', onclick: () => UI.copyText(code, 'Code copied') }, h('span', { html: icon('copy', 15) }), 'Copy code'),
            h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { if (navigator.share) { try { await navigator.share({ title: 'Together, Apart', text: 'Come join our little world 💛', url: link }); } catch {} } else UI.copyText(link, 'Invite link copied'); } }, h('span', { html: icon('share', 15) }), 'Share invitation')))),
    });
  });
}

boot();
