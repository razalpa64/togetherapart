// SURPRISES — sealed until their moment. The server guards the seal.
import { api } from '../api.js';
import { store, partner } from '../state.js';
import { on } from '../bus.js';
import { h, icon, toast, modal, field, fmtCountdown, emptyState } from '../ui.js';

const TYPES = [
  { id: 'letter', label: 'A letter', emoji: '✉️', hint: 'Words that unlock at just the right time.' },
  { id: 'gift', label: 'A little gift', emoji: '🎁', hint: 'An object with meaning. It\'s the thought, embodied.' },
  { id: 'invite', label: 'A date invitation', emoji: '🌙', hint: '“Meet me tonight at 9.”' },
  { id: 'memories', label: 'A memory surprise', emoji: '📸', hint: 'A collection of your moments, wrapped up.', premium: true },
];
const UNLOCK_PRESETS = [
  { id: 'wake', label: 'When they wake up', emoji: '🌅', hours: null },      // tomorrow 6am
  { id: 'tonight', label: 'Tonight at midnight', emoji: '🌃' },
  { id: 'hours3', label: 'In 3 hours', emoji: '⏳' },
  { id: 'custom', label: 'A specific moment', emoji: '🗓️' },
];

export function render(root) {
  let surprises = [];
  const offs = [];
  const list = h('div', { class: 'sur-list' });

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, 'Sealed until their moment'),
        h('h1', { class: 'display-2' }, 'Surprises'),
        h('p', {}, 'Prepare something they can\'t see yet. Not even a peek.')),
      h('div', { class: 'actions' },
        partner() ? h('button', { class: 'btn btn-primary', onclick: create }, h('span', { html: icon('plus', 16) }), 'Prepare a surprise') : '')),
    list));

  async function load() {
    const d = await api('GET', '/api/surprises').catch(() => null);
    surprises = d?.surprises || [];
    draw();
  }

  function draw() {
    if (!surprises.length) {
      list.replaceChildren(emptyState(partner() ? 'Nothing waiting — yet.' : 'Soon.',
        partner() ? 'Prepare a little something for them.' : 'Invite your partner first, then plot away.'));
      return;
    }
    list.replaceChildren(...surprises.map(s => {
      const mine = s.fromUser === store.me.user.id;
      const openable = s.forMe && s.unlocked;
      const type = TYPES.find(t => t.id === s.type) || TYPES[0];
      const card = h('div', { class: 'card sur-card' },
        h('span', { class: 'ic' }, openable || (s.openedAt) ? type.emoji : '🔒'),
        h('div', { class: 'tag' }, (mine ? 'from you · ' : 'for you · ') + type.label),
        s.payload && (s.openedAt || (s.forMe && s.unlocked)) ? h('h3', { class: 'h3' }, s.payload.title || 'For you') :
          h('div', { class: 'sealed-note' }, 'Sealed. ' + (mine ? 'They can\'t see this yet.' : 'You can\'t see this yet.')),
        s.openedAt ? h('div', { class: 'when faint small' }, 'opened') :
          h('div', { class: 'countdown' }, fmtCountdown(s.unlockAt - Date.now()) + (s.forMe ? ' until it opens' : ' until it opens for them')),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } },
          openable && !s.openedAt ? h('button', { class: 'btn btn-rose btn-sm', onclick: () => open(s) }, 'Open it') : '',
          s.openedAt && s.forMe ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => open(s, true) }, 'Read it again') : '',
          mine ? h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await api('DELETE', '/api/surprises/' + s.id).catch(e => toast(e.message)); load(); } }, 'Unsend') : ''));
      return card;
    }));
  }

  function open(s, again = false) {
    api('POST', '/api/surprises/' + s.id + '/open').then(d => { if (!again) reveal(d.surprise); else reveal(d.surprise, true); load(); })
      .catch(e => toast(e.message));
  }

  function reveal(s, quiet = false) {
    const p = s.payload || {};
    const body = h('div', { class: 'surprise-hero' },
      h('div', { class: 'seal-viz', style: { animation: quiet ? 'none' : 'modalIn .8s var(--ease)' } }, '✶'),
      h('h2', { class: 'display-2', style: { fontSize: '1.7rem' } }, p.title || 'For you'),
      p.gift ? h('div', { style: { fontSize: '3.2rem', margin: '14px 0' } }, p.gift) : '',
      p.body ? h('p', { class: 'muted', style: { whiteSpace: 'pre-wrap', maxWidth: '46ch', margin: '10px auto' } }, p.body) : '',
      p.note ? h('p', { class: 'small', style: { fontStyle: 'italic' } }, p.note) : '',
      p.dateLabel ? h('p', { class: 'h3', style: { margin: '12px 0' } }, p.dateLabel) : '',
      s.type === 'memories' ? h('button', { class: 'btn btn-ghost btn-sm', style: { marginTop: '12px' }, onclick: () => { location.hash = '#/memories'; } }, 'Walk through them together') : '',
      h('button', { class: 'btn btn-primary', style: { marginTop: '18px' }, onclick: () => { location.hash = '#/chat'; } }, 'Say something'));
    modal({ title: '', body, actions: [] });
  }

  function create() {
    let type = 'letter';
    let unlockPreset = 'wake';
    const typeSel = h('div', { class: 'seg' }, TYPES.map(t => h('button', { class: t.id === type ? 'on' : '', onclick: (e) => {
      if (t.premium && !isPremium()) { toast('Memory surprises are part of Premium — see Settings for the demo switch.'); return; }
      type = t.id; typeSel.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on');
      hint.textContent = TYPES.find(x => x.id === type).hint;
    } }, t.emoji + ' ' + t.label + (t.premium && !isPremium() ? ' ✦' : ''))));
    const hint = h('p', { class: 'small muted', style: { marginTop: '8px' } }, TYPES[0].hint);
    const unlockSel = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, UNLOCK_PRESETS.map(u => h('button', { class: 'chip' + (u.id === 'wake' ? ' on' : ''), onclick: (e) => {
      unlockPreset = u.id; unlockSel.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on');
      customRow.style.display = u.id === 'custom' ? '' : 'none';
    } }, u.emoji + ' ' + u.label)));
    const customWhen = h('input', { class: 'input', type: 'datetime-local' });
    const customRow = h('div', { style: { display: 'none', marginTop: '10px' } }, customWhen);
    const title = h('input', { class: 'input', placeholder: 'Open this when you wake up', maxlength: '120' });
    const bodyTa = h('textarea', { class: 'input', rows: '5', placeholder: 'Write it like you\'d say it. However long it needs to be.' });
    const gift = h('input', { class: 'input', placeholder: '🎧 🌷 🧣 — pick something meaningful', maxlength: '8' });
    const dateLabel = h('input', { class: 'input', placeholder: 'Meet me tonight at 9 — rooftop?', maxlength: '120' });

    const dynamic = h('div', {});
    const redrawDynamic = () => {
      dynamic.replaceChildren();
      if (type === 'letter' || type === 'memories') dynamic.append(field('Title', title), field(type === 'letter' ? 'The letter' : 'A note about these memories', bodyTa));
      if (type === 'gift') dynamic.append(field('Title', title), field('The gift', gift), field('A note with it (optional)', h('textarea', { class: 'input', rows: '2', oninput: (e) => bodyTa.value = e.target.value })));
      if (type === 'invite') dynamic.append(field('The invitation', dateLabel), field('Anything else (optional)', h('textarea', { class: 'input', rows: '2', oninput: (e) => bodyTa.value = e.target.value })));
    };
    typeSel.querySelectorAll('button').forEach(b => b.addEventListener('click', redrawDynamic));
    redrawDynamic();

    modal({ title: 'Prepare a surprise', wide: true, body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('What is it?', typeSel), hint,
      field('When can they open it?', h('div', {}, unlockSel, customRow)),
      dynamic),
      actions: [{ label: 'Seal it', class: 'btn-primary', onclick: async (close) => {
        let unlockAt;
        const now = new Date();
        if (unlockPreset === 'wake') { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(6, 0, 0, 0); unlockAt = d.getTime(); }
        else if (unlockPreset === 'tonight') { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); unlockAt = d.getTime(); }
        else if (unlockPreset === 'hours3') unlockAt = Date.now() + 3 * 3600_000;
        else { if (!customWhen.value) { toast('Pick the exact moment.'); return false; } unlockAt = new Date(customWhen.value).getTime(); }
        try {
          await api('POST', '/api/surprises', { type, title: title.value || dateLabel.value || 'For you', body: bodyTa.value, gift: gift.value, dateLabel: dateLabel.value, unlockAt });
          close(); load();
          toast('Sealed. They\'ll have no idea — until they do.');
        } catch (e) { toast(e.message); }
      } }] });
  }

  offs.push(on('entity:surprises', () => load()));
  offs.push(on('ws:surprise:unlocked', () => load()));
  load();
  return { destroy() { offs.forEach(off => off()); } };
}
