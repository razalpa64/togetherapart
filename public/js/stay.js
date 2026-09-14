// JUST STAY — the quietest, most important feature. Presence over conversation.
import { send } from './ws.js';
import { on } from './bus.js';
import { h, icon, toast, floatEmoji } from './ui.js';
import { store, partner, isPremium } from './state.js';
import { play, stop, playing, AMBIENCES } from './audio.js';
import { startCall } from './rtc.js';

export const STAY_ENVS = [
  { id: 'rain', label: 'Rainy bedroom', img: '/img/stay-rain.jpg', ambience: 'rain' },
  { id: 'balcony', label: 'Balcony at night', img: '/img/stay-balcony.jpg', ambience: 'night' },
  { id: 'beach', label: 'Beach at sunset', img: '/img/stay-beach.jpg', ambience: 'ocean' },
  { id: 'cafe', label: 'Quiet café', svg: cafeScene, ambience: 'cafe' },
  { id: 'apartment', label: 'Cozy apartment', img: '/img/hero-room.jpg', ambience: 'fire' },
  { id: 'cabin', label: 'Cabin', img: '/img/stay-cabin.jpg', ambience: 'fire', premium: true },
  { id: 'rooftop', label: 'Rooftop under stars', svg: rooftopScene, ambience: 'night', premium: true },
];

const LINES = [
  'No plans tonight. No talking needed.',
  'Just be here, with me.',
  'The rain has it covered.',
  'We don\'t need words for this.',
  'Stay as long as you like.',
  'This counts. This is enough.',
];

let open = false, handsOn = false, currentEnv = null, lineTimer = null, cleanups = [];

export function stayOverlayOpen() { return open; }

export function openStay(opts = {}) {
  if (open) return;
  if (opts.env) enterEnv(opts.env, { invite: opts.invite });
  else showPicker();
}

function showPicker() {
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' } });
  for (const env of STAY_ENVS) {
    const locked = env.premium && !isPremium();
    grid.append(h('button', {
      class: 'mood-btn' + (locked ? ' locked' : ''), style: { minWidth: '0', padding: '0', overflow: 'hidden', position: 'relative', aspectRatio: '16/10' },
      onclick: () => { if (locked) { m.close(); location.hash = '#/premium'; return; } m.close(); enterEnv(env.id); },
    },
      env.img ? h('img', { src: env.img, alt: env.label, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } })
        : h('span', { style: { position: 'absolute', inset: 0, html: env.svg(), overflow: 'hidden' }, class: 'grain' }),
      h('span', { style: { position: 'absolute', left: '10px', bottom: '8px', color: '#F6F0E4', fontSize: '0.82rem', fontWeight: 600, textShadow: '0 1px 6px rgba(0,0,0,0.6)', zIndex: 2 } }, env.label),
      locked ? h('span', { style: { position: 'absolute', top: '8px', right: '8px', background: 'rgba(20,15,10,0.65)', color: '#F2EADD', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '999px', zIndex: 2 } }, 'PREMIUM') : ''));
  }
  const m = modalLike('Just Stay', h('div', {},
    h('p', { class: 'muted small', style: { marginBottom: '16px' } }, 'Pick somewhere quiet. No agenda — just being in the same place.'),
    grid));
}

function modalLike(title, body) {
  const overlay = h('div', { class: 'overlay' });
  const m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', { class: 'h1', style: { marginBottom: '4px' } }, title), body);
  overlay.append(m);
  document.getElementById('overlays').append(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  return { el: m, close };
}

function enterEnv(envId, { invite = false } = {}) {
  const env = STAY_ENVS.find(e => e.id === envId) || STAY_ENVS[0];
  open = true; currentEnv = env; handsOn = false;
  stop();

  const whoPill = h('div', { class: 'who', id: 'stay-who' });
  const bg = h('div', { class: 'stay-bg' }, env.img ? h('img', { src: env.img, alt: env.label }) : h('div', { style: { position: 'absolute', inset: 0, html: env.svg() } }));
  const line = h('div', { class: 'line', id: 'stay-line' }, invite ? 'They don\'t need anything. They just want you here.' : LINES[Math.floor(Math.random() * LINES.length)]);
  const handsGlow = h('div', { class: 'hands-glow', id: 'hands-glow', style: { display: 'none' } }, h('span', { html: icon('heart', 16) }), 'you\'re holding hands');

  const ambBtn = h('button', { class: 'sctl', id: 'stay-amb', onclick: () => {
    if (playing() === env.ambience) { stop(); ambBtn.classList.remove('on'); }
    else { play(env.ambience); ambBtn.classList.add('on'); }
  } }, h('span', {}, AMBIENCES.find(a => a.id === env.ambience)?.emoji || '🎧'), h('span', {}, AMBIENCES.find(a => a.id === env.ambience)?.label || 'Ambience'));
  const handsBtn = h('button', { class: 'sctl', id: 'stay-hands', onclick: () => { handsOn = !handsOn; send({ t: 'stay', action: 'hands', on: handsOn, env: env.id }); renderHands(); } }, h('span', { html: icon('heart', 15) }), h('span', {}, 'Hold hands'));
  const hugBtn = h('button', { class: 'sctl', onclick: () => { send({ t: 'interaction', type: 'hug' }); floatEmoji('🤗'); pulseWarm(); } }, 'Send a hug');
  const voiceBtn = h('button', { class: 'sctl', onclick: () => startCall({ video: false }) }, h('span', { html: icon('mic', 15) }), h('span', {}, 'Voice'));
  const leaveBtn = h('button', { class: 'sctl', onclick: () => leaveStay(), 'aria-label': 'Leave' }, h('span', { html: icon('x', 15) }), h('span', {}, 'Leave'));

  const reactions = h('div', { class: 'stay-controls' }, ['❤️', '🌙', '☕', '🌿', '⭐'].map(e => h('button', { class: 'sctl', style: { padding: '8px 14px' }, onclick: () => { send({ t: 'float', emoji: e }); floatEmoji(e); } }, e)));

  const stay = h('div', { class: 'stay grain', role: 'dialog', 'aria-label': 'Just Stay — ' + env.label },
    bg,
    h('div', { class: 'stay-top' }, whoPill, h('button', { class: 'sctl', onclick: () => leaveStay() }, h('span', { html: icon('x', 14) }), 'Leave')),
    h('div', { class: 'stay-mid' }, line, handsGlow),
    h('div', { class: 'stay-bottom' },
      h('div', { class: 'stay-controls' }, ambBtn, handsBtn, hugBtn, voiceBtn),
      reactions));

  document.body.append(stay);
  document.title = 'Just staying — Together, Apart';
  updateWho();
  send({ t: 'stay', action: 'join', env: env.id });
  send({ t: 'presence', state: 'just_staying' });

  lineTimer = setInterval(() => {
    const el = document.getElementById('stay-line');
    if (el && open) { el.style.opacity = 0; setTimeout(() => { el.textContent = LINES[Math.floor(Math.random() * LINES.length)]; el.style.opacity = 1; }, 700); }
  }, 22000);

  const offStay = on('ws:stay', (m) => {
    if (!open) return;
    if (m.action === 'join' && m.env === env.id) updateWho();
    if (m.action === 'leave') updateWho();
    if (m.action === 'hands') { handsOn = m.on; renderHands(); }
  });
  const offPresence = on('presenceChanged', () => { if (open) updateWho(); });
  const offFloat = on('ws:float', ({ from, emoji }) => { if (from !== store.me?.user?.id) floatEmoji(emoji); });
  cleanups = [offStay, offPresence, offFloat];

  function renderHands() {
    const g = document.getElementById('hands-glow');
    const b = document.getElementById('stay-hands');
    if (g) g.style.display = handsOn ? '' : 'none';
    if (b) b.classList.toggle('on', handsOn);
    if (handsOn) pulseWarm();
  }
  function updateWho() {
    const p = partner();
    const el = document.getElementById('stay-who');
    if (!el) return;
    const online = p && store.presence[p.userId]?.online && store.presence[p.userId]?.state === 'just_staying';
    el.textContent = online ? 'You\'re both here.' : 'You\'re here. They can join anytime.';
  }
  function pulseWarm() {
    stay.style.transition = 'box-shadow 1.2s';
    stay.style.boxShadow = 'inset 0 0 180px rgba(217,169,92,0.35)';
    setTimeout(() => { stay.style.boxShadow = 'none'; }, 2600);
  }
}

export function leaveStay() {
  if (!open) return;
  open = false; handsOn = false;
  clearInterval(lineTimer);
  cleanups.forEach(off => off());
  stop();
  send({ t: 'stay', action: 'leave' });
  send({ t: 'presence', state: 'online' });
  document.querySelectorAll('.stay').forEach(e => e.remove());
  document.title = (store.me?.couple?.name || 'Our Place') + ' — Together, Apart';
}

// Stay invites arriving while elsewhere in the app:
export function initStayInvites() {
  on('ws:stay', (m) => {
    if (open || m.from === store.me?.user?.id) return;
    if (m.action === 'join') {
      const env = STAY_ENVS.find(e => e.id === m.env) || STAY_ENVS[0];
      toast('They don\'t need anything. They just want you here.', { actionLabel: 'Join them', onAction: () => openStay({ env: m.env, invite: true }), dur: 15000 });
    }
  });
}

/* ---------- hand-crafted premium scenes ---------- */
function cabinScene() {
  const stars = Array.from({ length: 26 }, (_, i) => `<circle class="e-star" cx="${20 + (i * 61) % 180}" cy="${14 + (i * 37) % 60}" r="${1 + (i % 3) * 0.5}" fill="#EFE6D6" style="animation-delay:${(i * 0.4).toFixed(1)}s"/>`).join('');
  const embers = Array.from({ length: 7 }, (_, i) => `<circle cx="${70 + i * 12}" cy="${0}" r="2" fill="#E8B06A" style="display:none"/>`).join('');
  return `<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%">
    <rect width="400" height="250" fill="#241A12"/>
    <rect x="290" y="20" width="90" height="70" rx="6" fill="#171009"/>
    <g>${stars}</g>
    <path d="M290,20 L335,4 L380,20" fill="#171009"/>
    <path d="M298,60 q14,-16 30,-2 q16,-14 32,2 l0,30 l-62,0 z" fill="#1E2A1E"/>
    <rect x="0" y="90" width="400" height="160" fill="#2E2118"/>
    <rect x="0" y="90" width="400" height="8" fill="#3E2E22"/>
    <ellipse class="e-glow" cx="120" cy="215" rx="150" ry="60" fill="#D9A95C" opacity="0.14"/>
    <g>
      <rect x="55" y="150" width="130" height="90" rx="8" fill="#3A3A3A"/>
      <rect x="67" y="162" width="106" height="78" rx="5" fill="#171009"/>
      <g class="e-fire">
        <path d="M120,225 q-26,-18 -12,-44 q4,12 12,14 q-4,-22 10,-34 q0,16 12,26 q12,12 2,24 q14,-4 14,-20 q14,18 -8,32 q-14,10 -20,2z" fill="#E8B06A"/>
        <path d="M120,226 q-14,-10 -6,-26 q3,8 7,9 q-2,-13 6,-19 q1,9 6,15 q7,8 1,15 q8,-2 8,-11 q8,10 -5,17 q-8,5 -11,2z" fill="#F2D9A0"/>
      </g>
      <rect x="52" y="240" width="136" height="10" fill="#241A12"/>
    </g>
    <ellipse cx="120" cy="252" rx="110" ry="9" fill="#B4766B" opacity="0.5"/>
    <g opacity="0.92">
      <path d="M245,175 q10,-40 40,-40 q30,0 40,40 l0,75 l-80,0 z" fill="#4A3A2C"/>
      <path d="M245,175 q-10,-34 -32,-34 q-22,0 -30,34 l0,75 l62,0 z" fill="#413326"/>
      <rect x="235" y="170" width="82" height="10" rx="5" fill="#5D2A33"/>
    </g>
    <path d="M240,250 q30,-26 60,0" stroke="#8A6844" stroke-width="4" fill="none"/>
  </svg>`;
}
function rooftopScene() {
  const stars = Array.from({ length: 70 }, (_, i) => `<circle class="e-star" cx="${(i * 53) % 400}" cy="${(i * 29) % 130}" r="${0.8 + (i % 4) * 0.45}" fill="#EFE6D6" style="animation-delay:${(i * 0.33).toFixed(1)}s"/>`).join('');
  return `<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%">
    <rect width="400" height="250" fill="#141826"/>
    <g>${stars}</g>
    <circle cx="330" cy="46" r="16" fill="#EFE6D6" opacity="0.9"/>
    <circle cx="324" cy="42" r="3.4" fill="#C9C2B2"/><circle cx="336" cy="50" r="2.2" fill="#C9C2B2"/>
    <g fill="#0C0F1A">
      <rect x="0" y="150" width="46" height="100"/><rect x="52" y="128" width="30" height="122"/>
      <rect x="88" y="158" width="38" height="92"/><rect x="132" y="112" width="24" height="138"/>
      <rect x="162" y="146" width="42" height="104"/><rect x="210" y="132" width="28" height="118"/>
      <rect x="244" y="162" width="36" height="88"/><rect x="286" y="140" width="26" height="110"/>
      <rect x="318" y="170" width="44" height="80"/><rect x="368" y="150" width="32" height="100"/>
    </g>
    <g fill="#E8B06A" opacity="0.85">
      ${Array.from({ length: 34 }, (_, i) => `<rect x="${6 + (i * 41) % 388}" y="${160 + (i * 23) % 80}" width="3" height="4" rx="1"/>`).join('')}
    </g>
    <rect x="0" y="196" width="400" height="54" fill="#22242E"/>
    <rect x="0" y="196" width="400" height="4" fill="#33364A"/>
    <ellipse cx="120" cy="238" rx="96" ry="16" fill="#3A2E2A"/>
    <path d="M60,226 q60,-26 120,0 l-8,14 q-52,-20 -104,0 z" fill="#5D2A33"/>
    <path d="M64,222 q56,-22 112,0" stroke="#B4766B" stroke-width="6" fill="none" stroke-linecap="round"/>
    <g>
      <rect x="290" y="204" width="14" height="26" rx="3" fill="#5C4A33"/>
      <ellipse class="e-glow" cx="297" cy="200" rx="34" ry="18" fill="#E8B06A" opacity="0.35"/>
      <path class="e-fire" d="M297,196 q-6,-6 -3,-13 q3,4 5,4 q-1,-6 3,-9 q0,7 4,10 q3,4 0,7 q3,-1 3,-5 q3,5 -2,8 q-4,3 -6,1z" fill="#F2D9A0"/>
    </g>
    <g fill="#EFE6D6" opacity="0.9"><circle cx="40" cy="216" r="2.4"/><circle cx="76" cy="222" r="2"/><circle cx="190" cy="218" r="2.2"/></g>
  </svg>`;
}
