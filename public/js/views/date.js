// DATE NIGHT — plan it, start it, live it together. Steps stay in sync.
import { api, mediaUrl } from '../api.js';
import { store, partner } from '../state.js';
import { on } from '../bus.js';
import { send } from '../ws.js';
import { h, icon, toast, modal, field } from '../ui.js';
import { openStay } from '../stay.js';
import { renderGame } from '../games/index.js';

const MOODS = [
  { id: 'romantic', label: 'Romantic', emoji: '🕯️' },
  { id: 'chill', label: 'Chill', emoji: '🛋️' },
  { id: 'playful', label: 'Playful', emoji: '🎲' },
  { id: 'adventurous', label: 'Adventurous', emoji: '🧭' },
  { id: 'deep', label: 'Deep talk', emoji: '🌊' },
  { id: 'low', label: 'Low energy', emoji: '🌙' },
  { id: 'celebration', label: 'Celebration', emoji: '🥂' },
];
const ENV_IMG = {
  dinner: '/img/moment-dinner.jpg', apartment: '/img/hero-room.jpg', cafe: '/img/stay-cabin.jpg', cabin: '/img/stay-cabin.jpg',
  balcony: '/img/stay-balcony.jpg', rain: '/img/stay-rain.jpg', beach: '/img/stay-beach.jpg',
};

let activeOverlay = null;

export function render(root) {
  let mood = 'chill', minutes = 45, energy = 2, plan = null;
  let dates = [];
  const offs = [];
  const planBox = h('div', {});
  const savedBox = h('div', {});

  const moodGrid = h('div', { class: 'mood-grid', role: 'radiogroup', 'aria-label': 'Mood' },
    MOODS.map(m => h('button', {
      class: 'mood-btn' + (m.id === mood ? ' on' : ''), role: 'radio', 'aria-checked': String(m.id === mood),
      onclick: (e) => { mood = m.id; moodGrid.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); },
    }, h('span', { class: 'e' }, m.emoji), h('span', {}, m.label))));

  const durSeg = h('div', { class: 'seg', 'aria-label': 'Duration' },
    [15, 30, 45, 60, 90].map(d => h('button', { class: d === minutes ? 'on' : '', onclick: (e) => { minutes = d; durSeg.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, d + ' min')));

  const energySeg = h('div', { class: 'seg', 'aria-label': 'Energy' },
    [['Low battery', 1], ['Easy going', 2], ['Up for anything', 3]].map(([l, v]) => h('button', { class: v === energy ? 'on' : '', onclick: (e) => { energy = v; energySeg.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, l)));

  const notes = h('textarea', { class: 'input', placeholder: '“We only have 30 minutes tonight. She\'s exhausted from college. Something relaxing.”', rows: '2' });

  const generate = async () => {
    const btn = document.getElementById('plan-btn');
    btn.disabled = true; btn.textContent = 'Planning…';
    try {
      const d = await api('POST', '/api/dates/plan', { minutes, mood, energy, notes: notes.value });
      plan = d.plan;
      drawPlan();
    } catch (e) { toast(e.message); }
    btn.disabled = false; btn.replaceChildren(h('span', { html: icon('wand', 16) }), 'Plan our date');
  };

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, 'Tonight, or whenever'),
        h('h1', { class: 'display-2' }, 'Date Night'),
        h('p', {}, 'Pick a mood and the time you have. The planner does the rest.'))),
    h('div', { class: 'card card-pad', style: { marginBottom: '22px' } },
      h('div', { class: 'field', style: { marginBottom: '18px' } }, h('label', { style: { fontWeight: 600, fontSize: '0.9rem' } }, 'Mood'), moodGrid),
      h('div', { style: { display: 'flex', gap: '22px', flexWrap: 'wrap', marginBottom: '18px' } },
        h('div', { class: 'field' }, h('label', { style: { fontWeight: 600, fontSize: '0.9rem' } }, 'How long?'), durSeg),
        h('div', { class: 'field' }, h('label', { style: { fontWeight: 600, fontSize: '0.9rem' } }, 'Energy tonight'), energySeg)),
      field('Anything the planner should know? (optional)', notes),
      h('button', { class: 'btn btn-primary', id: 'plan-btn', style: { marginTop: '18px' }, onclick: generate }, h('span', { html: icon('wand', 16) }), 'Plan our date')),
    planBox, savedBox));

  function drawPlan() {
    planBox.replaceChildren();
    if (!plan) return;
    const envImg = ENV_IMG[plan.env] || ENV_IMG.apartment;
    planBox.append(h('div', { class: 'card date-plan', style: { marginBottom: '26px' } },
      h('div', { class: 'head' },
        h('div', { class: 'bg' }, h('img', { src: envImg, alt: '' })),
        h('span', { class: 'eyebrow', style: { color: 'var(--rose-2)' } }, plan.minutes + ' minutes · ' + (MOODS.find(m => m.id === plan.mood)?.label || '')),
        h('h2', { class: 'display-2', style: { margin: '6px 0 2px' } }, plan.title),
        plan.notes ? h('p', { class: 'small muted' }, '“' + plan.notes + '”') : ''),
      h('div', { class: 'plan-steps' },
        plan.steps.map(s => h('div', { class: 'plan-step' },
          h('time', {}, s.time), h('div', {}, h('div', { class: 't' }, s.icon + '  ' + s.title), h('div', { class: 'd' }, s.desc))))),
      h('div', { style: { display: 'flex', gap: '10px', padding: '18px 28px 22px', flexWrap: 'wrap', borderTop: '1px solid var(--line)' } },
        h('button', { class: 'btn btn-ghost', onclick: generate }, h('span', { html: icon('refresh', 15) }), 'Generate another'),
        h('button', { class: 'btn btn-ghost', onclick: async () => { await api('POST', '/api/dates', { plan }).catch(e => toast(e.message)); toast('Saved for later.'); loadDates(); } }, 'Save date'),
        partner() ? h('button', { class: 'btn btn-rose', onclick: async () => { const d = await api('POST', '/api/dates', { plan }); toast('Sent to them — no pressure, all pressure.'); loadDates(); send({ t: 'song:sync', data: { kind: 'date-plan', title: plan.title } }); } }, h('span', { html: icon('send', 15) }), 'Send to partner') : '',
        h('button', { class: 'btn btn-primary', onclick: async () => {
          const d = await api('POST', '/api/dates', { plan });
          const started = await api('POST', `/api/dates/${d.date.id}/start`);
          openActive(started.date);
          loadDates();
        } }, 'Start date now'))));
  }

  async function loadDates() {
    const d = await api('GET', '/api/dates').catch(() => null);
    dates = d?.dates || [];
    savedBox.replaceChildren();
    const saved = dates.filter(x => x.status !== 'active');
    if (!saved.length) return;
    savedBox.append(h('h2', { class: 'h2', style: { margin: '8px 0 14px' } }, 'Kept dates'),
      h('div', { class: 'cd-list' }, saved.slice(0, 6).map(dt => {
        const p = parsePlan(dt.plan);
        return h('div', { class: 'cd-card card', style: { padding: '16px' } },
          h('div', { class: 'tag', style: { color: dt.status === 'done' ? 'var(--sage)' : 'var(--ink-3)' } }, dt.status === 'done' ? '★ happened' : p.minutes + ' min · ' + p.title),
          h('div', { style: { margin: '8px 0 12px', fontSize: '0.9rem', color: 'var(--ink-2)' } }, p.steps.map(s => s.icon + ' ' + s.title).join(' · ')),
          h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center' } },
            dt.status !== 'done' ? h('button', { class: 'btn btn-primary btn-sm', onclick: async () => { const s = await api('POST', `/api/dates/${dt.id}/start`); openActive(s.date); loadDates(); } }, 'Start this one') : '',
            h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await api('DELETE', '/api/dates/' + dt.id).catch(() => {}); loadDates(); } }, 'Remove')));
      })));
  }

  /* ---------- active date overlay ---------- */
  function openActive(date) {
    closeActive();
    const p = parsePlan(date.plan);
    const steps = p.steps;
    let step = date.currentStep || 0;

    const stepNum = h('span', { class: 'date-step-num' });
    const prog = h('progress', { class: 'slim', value: 0, max: steps.length - 1 || 1, style: { width: '160px' } });
    const body = h('div', { class: 'da-body' });
    const prevBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => advance(-1) }, h('span', { html: icon('chevl', 14) }), 'Back');
    const nextBtn = h('button', { class: 'btn btn-primary', onclick: () => advance(1) }, 'Next', h('span', { html: icon('chevr', 15) }));

    const overlay = h('div', { class: 'date-active', role: 'dialog', 'aria-label': 'Date night — ' + p.title },
      h('div', { class: 'da-head' },
        h('button', { class: 'icon-btn', 'aria-label': 'End date', html: icon('x', 18), onclick: () => finish(true) }),
        h('div', {}, h('h2', { class: 'h2' }, p.title), stepNum),
        prog),
      body,
      h('div', { class: 'da-foot' }, prevBtn, nextBtn));
    document.body.append(overlay);
    activeOverlay = overlay;
    document.title = 'Date night — Together, Apart';
    send({ t: 'presence', state: 'watching', activity: 'on a date' });

    function drawStep() {
      const s = steps[step] || steps[0];
      stepNum.textContent = `Step ${step + 1} of ${steps.length}`;
      prog.value = step;
      body.replaceChildren();
      const title = h('h2', { class: 'display-2', style: { fontSize: 'clamp(1.6rem,4vw,2.4rem)' } }, s.icon + '  ' + s.title);
      const desc = h('p', { class: 'muted', style: { maxWidth: '48ch' } }, s.desc);
      const holder = h('div', { style: { width: 'min(680px, 94vw)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' } });
      body.append(holder);

      if (s.kind === 'arrive' || s.kind === 'sunset') {
        overlay.style.background = 'var(--paper)';
        holder.append(h('div', { style: { position: 'absolute', inset: 0, zIndex: -1, opacity: 0.24 } },
          h('img', { src: ENV_IMG[p.env] || ENV_IMG[s.kind === 'sunset' ? 'dinner' : p.env] || '/img/stay-balcony.jpg', alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } })));
      }
      holder.append(title, desc);

      if (s.kind === 'cards' || s.kind === 'question') {
        const deck = s.kind === 'question' ? 'deep' : (s.deck || 'cards');
        const cardBox = h('div', { class: 'card card-pad', style: { maxWidth: '480px', textAlign: 'center', position: 'relative' } });
        const drawBtn = h('button', { class: 'btn btn-primary', onclick: async () => {
          const d = await api('GET', '/api/decks/' + deck);
          const q = d.deck[Math.floor(Math.random() * d.deck.length)];
          cardBox.replaceChildren(h('p', { class: 'serif', style: { fontSize: '1.35rem', lineHeight: 1.35 } }, Array.isArray(q) ? q[0] + ' or ' + q[1] : q));
          send({ t: 'song:sync', data: { kind: 'date-card', q: Array.isArray(q) ? q.join('|') : q } });
        } }, 'Draw a card');
        cardBox.append(h('p', { class: 'faint small' }, 'Both of you draw the same card. Take your time.'));
        cardBox.append(drawBtn);
        holder.append(cardBox);
      }
      if (s.kind === 'game' && s.game) {
        const g = h('div', { style: { width: '100%', display: 'flex', justifyContent: 'center' } });
        holder.append(g);
        renderGame(g, s.game, () => {});
      }
      if (s.kind === 'photo') {
        holder.append(h('button', { class: 'btn btn-rose', onclick: () => { location.hash = '#/booth'; } }, h('span', { html: icon('camera', 16) }), 'Take a couple photo'));
      }
      if (s.kind === 'song') {
        const t = h('input', { class: 'input', placeholder: 'The song you\'re thinking of…', style: { maxWidth: '340px' } });
        holder.append(t, h('button', { class: 'btn btn-primary', onclick: async () => {
          if (!t.value.trim()) { toast('Even just the title.'); return; }
          await api('POST', '/api/songs', { title: t.value.trim(), note: 'chosen during “' + p.title + '”' });
          toast('Added to Our Songs. No explaining — they\'ll figure it out.');
          t.value = '';
        } }, 'Send it to Our Songs'));
      }
      if (s.kind === 'letter') {
        const t = h('textarea', { class: 'input', placeholder: 'Three sentences. Give it to them when the date ends.', rows: '4', style: { maxWidth: '440px' } });
        holder.append(t, h('button', { class: 'btn btn-primary', onclick: async () => {
          if (!t.value.trim()) { toast('Write even one true sentence.'); return; }
          await api('POST', '/api/surprises', { type: 'letter', title: 'A letter from your date', body: t.value, unlockAt: Date.now() + 3600_000 });
          toast('Sealed. It opens in an hour.');
          t.value = '';
        } }, 'Seal it for later'));
      }
      if (s.kind === 'gratitude') {
        const t = h('textarea', { class: 'input', placeholder: 'One thing you\'re grateful for, about them…', rows: '3', style: { maxWidth: '440px' } });
        holder.append(t, h('button', { class: 'btn btn-primary', onclick: async () => {
          if (!t.value.trim()) { toast('Say it — however small.'); return; }
          await api('POST', '/api/messages', { type: 'text', body: '💛 ' + t.value.trim() });
          toast('Sent.');
          t.value = '';
        } }, 'Say it, then send it'));
      }
      if (s.kind === 'tea') holder.append(h('button', { class: 'btn btn-subtle', onclick: () => { send({ t: 'float', emoji: '☕' }); toast('Two cups. Steam on.'); } }, '☕ Make it'));
      if (s.kind === 'rain') holder.append(h('button', { class: 'btn btn-rose', onclick: () => openStay({ env: 'rain' }) }, '🌧️ Sit in the rain together'));
      if (s.kind === 'dance') holder.append(h('button', { class: 'btn btn-subtle', onclick: () => { send({ t: 'interaction', type: 'dance' }); } }, '🕺 Kitchen rules'));
      if (s.kind === 'memory') holder.append(h('button', { class: 'btn btn-subtle', onclick: () => { location.hash = '#/memories'; } }, 'Open Memories'));
      if (s.kind === 'future') holder.append(h('button', { class: 'btn btn-subtle', onclick: () => { location.hash = '#/places'; } }, 'Open Places We\'ll Go'));
      if (s.kind === 'arrive' && p.env) { /* ambiance already set by bg */ }
    }

    async function advance(dir) {
      step = Math.min(Math.max(step + dir, 0), steps.length - 1);
      drawStep();
      const d = await api('POST', `/api/dates/${date.id}/advance`, { dir }).catch(() => null);
      if (d) date = d.date;
    }
    async function finish(ask) {
      let save = true;
      if (ask) save = await new Promise(res => modal({ title: 'End the date?', body: h('p', { class: 'muted' }, 'We\'ll keep it in Memories — the whole evening, step by step.'), actions: [{ label: 'Keep going', class: 'btn-ghost', onclick: () => res(false) }, { label: 'End & save', class: 'btn-primary', onclick: () => res(true) }] }));
      if (!save) return;
      const d = await api('POST', `/api/dates/${date.id}/finish`, { memory: true }).catch(() => null);
      closeActive();
      if (d?.memory) toast('Kept. Another one for the story.');
      loadDates();
      send({ t: 'presence', state: 'online', activity: null });
    }
    function closeActive() { if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; document.title = (store.me?.couple?.name || 'Our Place') + ' — Together, Apart'; } }

    // realtime follow
    offs.push(on('date:event', (m) => {
      if (!activeOverlay || m.id !== date.id) {
        if (m.type === 'started' && !activeOverlay) {
          toast('They started “' + parsePlan(m.date.plan).title + '”.', { actionLabel: 'Join the date', onAction: () => openActive(m.date) });
        }
        return;
      }
      if (m.type === 'step' && m.by !== store.me.user.id) { date = m.date; step = m.date.currentStep; drawStep(); }
      if (m.type === 'ended' && m.by !== store.me.user.id) { closeActive(); toast('The date ended softly. It\'s in Memories.'); loadDates(); }
    }));
    offs.push(on('ws:song:sync', ({ from, data }) => {
      if (from === store.me.user.id || !activeOverlay || !data) return;
      if (data.kind === 'date-card') {
        const cardBox = activeOverlay.querySelector('.card');
        if (cardBox) cardBox.replaceChildren(h('p', { class: 'serif', style: { fontSize: '1.35rem', lineHeight: 1.35 } }, data.q.split('|').join(' or ')));
      }
    }));

    drawStep();
  }

  // if a date is already running (e.g. after refresh), offer to rejoin
  (async () => {
    const d = await api('GET', '/api/dates').catch(() => null);
    const running = d?.dates.find(x => x.status === 'active');
    if (running) openActive(running);
    else loadDates();
  })();

  return { destroy() { offs.forEach(off => off()); } };
}
