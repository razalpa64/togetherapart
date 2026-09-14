// UI toolkit: DOM helper, icons, avatars, toasts, modals, sheets, menus, formatters.
import { resolveMedia, mediaUrl } from './api.js';

// Set an image src (or SVG image href) from a media id — works in both
// self-hosted mode (/api/media/…) and supabase mode (signed URLs).
export function applyMedia(el, id) {
  if (!id || !el) return;
  if (String(id).startsWith('demo:')) { setMediaSrc(el, mediaUrl(id)); return; }
  resolveMedia(id).then((u) => { if (u) setMediaSrc(el, u); }).catch(() => {});
}
function setMediaSrc(el, url) {
  if (String(el.tagName).toLowerCase() === 'image') el.setAttribute('href', url);
  else el.src = url;
}

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // only ever used with our own trusted strings
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(9)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
}

/* ---------------- icons ---------------- */
const P = {
  home: 'M3 10.5 12 3l9 7.5|M5 9.5V21h14V9.5',
  heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  calendar: 'M3 5h18v16H3z|M16 3v4|M8 3v4|M3 11h18',
  grid: 'M3 3h7v7H3z|M14 3h7v7h-7z|M14 14h7v7h-7z|M3 14h7v7H3z',
  image: 'M3 5h18v14H3z|M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z|M21 15l-5-5L5 19',
  chat: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z|M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  music: 'M9 18V5l12-2v13|M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M18 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  gift: 'M20 12v10H4V12|M2 7h20v5H2z|M12 22V7|M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z|M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 0 1-3.46 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z|M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z|M19 10v2a7 7 0 0 1-14 0v-2|M12 19v4|M8 23h8',
  micoff: 'M1 1l22 22|M9 9v3a3 3 0 0 0 5.12 2.12|M15 9.34V4a3 3 0 0 0-5.94-.6|M17 16.95A7 7 0 0 1 5 12v-2|M12 19v4|M8 23h8',
  video: 'M23 7l-7 5 7 5V7z|M1 5h15v14H1z',
  videooff: 'M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2|M1 1l22 22|M22 5l-8 6 3.34 2.39',
  phoneoff: 'M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6M1 1l22 22',
  send: 'M22 2 11 13|M22 2l-7 20-4-9-9-4 20-7z',
  plus: 'M12 5v14|M5 12h14',
  x: 'M18 6 6 18|M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  chevl: 'M15 18l-6-6 6-6', chevr: 'M9 18l6-6-6-6', chevd: 'M6 9l6 6 6-6',
  copy: 'M9 9h13v13H9z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8|M16 6l-4-4-4 4|M12 2v13',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M12 1v2|M12 21v2|M4.22 4.22l1.42 1.42|M18.36 18.36l1.42 1.42|M1 12h2|M21 12h2|M4.22 19.78l1.42-1.42|M18.36 5.64l1.42-1.42',
  volume: 'M11 5 6 9H2v6h4l5 4V5z|M15.54 8.46a5 5 0 0 1 0 7.07|M19.07 4.93a10 10 0 0 1 0 14.14',
  volumex: 'M11 5 6 9H2v6h4l5 4V5z|M23 9l-6 6|M17 9l6 6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.35-4.35',
  reply: 'M9 14 4 9l5-5|M20 20v-7a4 4 0 0 0-4-4H4',
  trash: 'M3 6h18|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6|M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 6v6l4 2',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75',
  refresh: 'M23 4v6h-6|M1 20v-6h6|M3.51 9a9 9 0 0 1 14.85-3.36L23 10|M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  lock: 'M5 11h14v10H5z|M7 11V7a5 5 0 0 1 10 0v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4|M16 17l5-5-5-5|M21 12H9',
  arrowr: 'M5 12h14|M12 5l7 7-7 7',
  play: 'M6 4l14 8-14 8V4z',
  pause: 'M7 5v14|M17 5v14',
  wifioff: 'M1 1l22 22|M16.72 11.06A10.94 10.94 0 0 1 19 12.55|M5 12.55a10.94 10.94 0 0 1 5.17-2.39|M10.71 5.05A16 16 0 0 1 22.58 9|M1.42 9a15.91 15.91 0 0 1 4.7-2.88|M8.53 16.11a6 6 0 0 1 6.95 0|M12 20h.01',
  sparkle: 'M12 3l1.88 5.76L20 10.5l-6.12 1.9L12 18l-1.88-5.6L4 10.5l6.12-1.74L12 3z',
  wand: 'M6 21l10.5-10.5|M18 4l.01 0|M21 7l.01 0|M18 10l.01 0|M15 4l.01 0|M21 11V3|M11 21H3',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71|M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  dots: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z|M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z|M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7|M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  crown: 'M2 18h20|M3 17l1.6-9L9.5 12 12 5l2.5 7 4.9-4L21 17z',
  hand: 'M18 11V6a2 2 0 0 0-4 0v5|M14 10V4a2 2 0 0 0-4 0v6|M10 10.5V6a2 2 0 0 0-4 0v8|M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
};
export function icon(name, size = 20, sw = 1.8) {
  const d = P[name] || P.dots;
  const paths = d.split('|').map(p => `<path d="${p}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/* ---------------- avatars ---------------- */
export const ACCENTS = { rose: { main: '#B4766B', tint: '#E5C6BF' }, amber: { main: '#B98A44', tint: '#E4D6B8' }, sage: { main: '#7D8471', tint: '#CBD2BE' }, slate: { main: '#6E7686', tint: '#CDD3DC' }, burgundy: { main: '#7A4049', tint: '#DCBFC1' } };
const SKIN = ['#E8C9A8', '#D8B48C', '#B98A68', '#8C6248', '#F0D9BE'];

function hairPath(hair, c) {
  switch (hair) {
    case 'long': return `<path d="M11.6 7.5C10.2 7 9.3 5.6 9.6 4.1 10 -0.4 16.6 -1 18.6 3c.7 1.4.6 3-.2 4.3-.4.6-.9 1-1.5 1.2v2.2c0 4-1.5 6.8-4.9 6.8-3.4 0-4.9-2.8-4.9-6.8V8.4z" fill="${c}"/>`;
    case 'medium': return `<path d="M12.8 7.8C10.9 7.6 9.4 6 9.5 4.1c.2-2.9 3.1-4.4 6-3.7 2.3.5 3.6 2.3 3.4 4.5-.1 1.2-.6 2.1-1.4 2.8v1.8c0 1-.6 1.6-1.6 1.6h-2.6c-1 0-1.6-.6-1.6-1.6z" fill="${c}"/><path d="M13.5 11.5v-3" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'curl': return `<g fill="${c}"><circle cx="15.5" cy="6.5" r="2.4"/><circle cx="18.6" cy="9.4" r="2.2"/><circle cx="12.6" cy="5" r="2.4"/><circle cx="17.7" cy="5.8" r="2.5"/><circle cx="20.2" cy="12" r="1.9"/></g>`;
    case 'bun': return `<circle cx="20" cy="6" r="2.8" fill="${c}"/><path d="M12.6 8C10.7 7.7 9.3 6.1 9.5 4.2 9.8 1.5 12.4.2 15 .7c2.3.4 3.7 2.1 3.5 4.2-.1 1.2-.6 2.2-1.4 2.9v1.7c0 1-.6 1.6-1.6 1.6h-1.3c-1 0-1.6-.6-1.6-1.6z" fill="${c}"/>`;
    default: return `<path d="M12.7 8C10.8 7.8 9.4 6.2 9.5 4.3 9.7 1.6 12.3.3 14.9.8c2.3.4 3.7 2.2 3.5 4.3-.1 1.2-.7 2.2-1.5 2.9z" fill="${c}"/>`;
  }
}
export function avatarSvg(accent = 'rose', hair = 'short', skinIdx = 0, size = 40) {
  const a = ACCENTS[accent] || ACCENTS.rose;
  const skin = SKIN[skinIdx % SKIN.length];
  const hairColor = ['#3A2E22', '#231A12', '#5A4632', '#8A6448', '#C9B79A', '#4A4A52'][skinIdx % 6];
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" role="img" aria-label="avatar"><circle cx="20" cy="20" r="20" fill="${a.tint}"/><g transform="translate(1.5,0)"><circle cx="20" cy="16.5" r="6.6" fill="${skin}"/>${hairPath(hair, hairColor)}<path d="M7.5 40c1.8-7.4 7-10.6 12.5-10.6S30.5 32.6 32.3 40z" fill="${a.main}"/></g></svg>`;
}
export function avatarEl(person, size = 40) {
  // person: {avatar (media id|null), accent, hair, name}
  const wrap = h('span', { class: 'avatar-wrap' });
  const av = h('span', { class: 'avatar', style: { width: size + 'px', height: size + 'px' }, 'aria-hidden': 'true' });
  if (person?.avatar) {
    const im = new Image(size, size);
    im.alt = '';
    applyMedia(im, person.avatar);
    av.append(im);
  } else {
    av.innerHTML = avatarSvg(person?.accent || 'rose', person?.hair || 'short', hashStr(person?.name || 'x'), size);
  }
  wrap.append(av);
  return wrap;
}
export function hashStr(s) { let n = 0; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n % 5; }

/* ---------------- toasts ---------------- */
export function toast(msg, opts = {}) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: 'toast', role: 'status' }, h('span', {}, msg));
  if (opts.actionLabel && opts.onAction) {
    t.append(h('button', { class: 't-act', onclick: () => { opts.onAction(); t.remove(); } }, opts.actionLabel));
  }
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, opts.dur || (opts.actionLabel ? 8000 : 4200));
  return t;
}
export function floatEmoji(emoji, x = null, y = null) {
  const el = h('span', { class: 'float-emoji' }, emoji);
  el.style.left = (x ?? (window.innerWidth / 2 + (Math.random() * 120 - 60))) + 'px';
  el.style.top = (y ?? (window.innerHeight * 0.4 + (Math.random() * 80 - 40))) + 'px';
  document.body.append(el);
  setTimeout(() => el.remove(), 2700);
}

/* ---------------- modal / sheet / menu ---------------- */
function hostOverlay(overlay, closeFn) {
  document.getElementById('overlays').append(overlay);
  const esc = (e) => { if (e.key === 'Escape') { close(); } };
  const close = () => { overlay.remove(); document.removeEventListener('keydown', esc); closeFn && closeFn(); };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', esc);
  // simple focus containment
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...overlay.querySelectorAll('button, input, textarea, select, a[href], [tabindex]')].filter(x => !x.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });
  return close;
}

export function modal({ title, body, actions = [], wide = false, onClose }) {
  const overlay = h('div', { class: 'overlay' });
  const m = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'dialog' });
  if (title) m.append(h('h2', { class: 'h1' }, title));
  const close = hostOverlay(overlay, onClose);
  m.append(body);
  if (actions.length) {
    const row = h('div', { class: 'actions', style: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', flexWrap: 'wrap' } });
    for (const a of actions) {
      row.append(h('button', {
        class: 'btn ' + (a.class || 'btn-ghost'),
        onclick: async () => { const r = a.onclick ? await a.onclick(close) : undefined; if (r !== false && a.closes !== false) close(); },
      }, a.label));
    }
    m.append(row);
  }
  overlay.append(m);
  const firstInput = m.querySelector('input, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 60);
  return { el: m, close };
}

export function sheet({ title, body, onClose }) {
  const overlay = h('div', { class: 'overlay', style: { alignItems: 'flex-end', justifyContent: 'stretch', padding: '0', background: 'rgba(24,18,12,0.35)' } });
  const s = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'sheet' },
    h('div', { class: 'sheet-grip' }),
    title ? h('h2', { class: 'h2', style: { marginBottom: '14px' } }, title) : '',
    body);
  const close = hostOverlay(overlay, onClose);
  overlay.append(s);
  return { el: s, close };
}

export function confirmDialog(title, msg, { danger = false, confirmLabel = 'Confirm', requireText = null } = {}) {
  return new Promise((resolve) => {
    const body = h('div', {}, h('p', { class: 'muted' }, msg));
    let input = null;
    if (requireText) {
      input = h('input', { class: 'input', placeholder: `type “${requireText}”`, style: { marginTop: '16px' } });
      body.append(input);
    }
    const mo = modal({
      title, body,
      actions: [
        { label: 'Cancel', class: 'btn-ghost', onclick: () => resolve(false) },
        {
          label: confirmLabel, class: danger ? 'btn-danger' : 'btn-primary', closes: false,
          onclick: (close) => {
            if (requireText && input.value.trim() !== requireText) { input.focus(); return false; }
            close(); resolve(true);
          },
        },
      ],
      onClose: () => resolve(false),
    });
  });
}

export function showMenu(items, anchor) {
  document.querySelectorAll('.menu').forEach(m => m.remove());
  const rect = anchor.getBoundingClientRect();
  const m = h('div', { class: 'menu', role: 'menu' });
  for (const it of items) {
    if (it === '-') { m.append(h('div', { class: 'sep' })); continue; }
    m.append(h('button', { role: 'menuitem', onclick: () => { m.remove(); it.onclick(); } }, it.icon ? h('span', { class: 'ic', html: icon(it.icon, 17) }) : '', it.label));
  }
  document.body.append(m);
  const mw = 220, mh = m.offsetHeight;
  m.style.left = Math.min(rect.right - mw, window.innerWidth - mw - 8) + 'px';
  m.style.top = Math.min(rect.bottom + 6, window.innerHeight - mh - 8) + 'px';
  const off = () => { m.remove(); document.removeEventListener('mousedown', off); };
  setTimeout(() => document.addEventListener('mousedown', off), 10);
  return m;
}

/* ---------------- formatters ---------------- */
export function fmtTime(ts) { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
export function fmtDay(ts) {
  const d = new Date(ts), today = new Date(), y = new Date(Date.now() - 864e5);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
export function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function fmtCountdown(ms) {
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60;
  if (d > 0) return d + (d === 1 ? ' day' : ' days');
  if (hh > 0) return hh + 'h ' + mm + 'm';
  return mm + 'm';
}
export function fmtDateLong(str) {
  if (!str) return '';
  const d = new Date(str + (str.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
export function parseLocalDate(str) { return new Date(str + 'T12:00:00').getTime(); }
export const initials = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();

/* ---------------- misc ---------------- */
export async function copyText(text, note = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(note); }
  catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } });
    ta.value = text; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast(note); } catch { toast('Couldn\'t copy — long-press to copy manually.'); }
    ta.remove();
  }
}
export function field(label, inputEl, hint) {
  return h('div', { class: 'field' }, h('label', {}, label), inputEl, hint ? h('div', { class: 'hint' }, hint) : null);
}
export function emptyState(title, sub, actionBtn) {
  const e = h('div', { class: 'empty' }, h('div', { class: 'big' }, title), sub ? h('div', { class: 'small muted' }, sub) : null);
  if (actionBtn) e.append(actionBtn);
  return e;
}
export function spinner() { return h('div', { class: 'spinner', role: 'progressbar', 'aria-label': 'loading' }); }
