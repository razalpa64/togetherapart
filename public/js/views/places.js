// PLACES WE'LL GO — the shared bucket list, with dreaming → planned → visited.
import { api, uploadMedia, mediaUrl } from '../api.js';
import { applyMedia } from '../ui.js';
import { on } from '../bus.js';
import { h, icon, toast, modal, field, emptyState, fmtCountdown, fmtDateLong, showMenu } from '../ui.js';

export function render(root) {
  let places = [];
  const offs = [];
  const grid = h('div', { class: 'place-grid' });

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, 'Someday, together'),
        h('h1', { class: 'display-2' }, 'Places We\'ll Go'),
        h('p', {}, 'Dream out loud. Plan recklessly. Mark them visited.')),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary', onclick: () => edit() }, h('span', { html: icon('plus', 16) }), 'Add a place'))),
    grid));

  async function load() {
    try {
      const d = await api('GET', '/api/places');
      places = d.places;
      draw();
    } catch (e) { toast(e.message); }
  }

  // Elegant generated cover art — consistent with the palette, no stock photos needed.
  function art(name) {
    let seed = 0; for (const c of name) seed += c.charCodeAt(0);
    const hues = ['#B4766B', '#B98A44', '#7D8471', '#96525B', '#6E7686'];
    const c1 = hues[seed % hues.length], c2 = hues[(seed + 2) % hues.length];
    return `<svg viewBox="0 0 320 180" style="width:100%;height:100%">
      <rect width="320" height="180" fill="#2A241C"/>
      <circle cx="${60 + seed % 180}" cy="52" r="20" fill="${c1}" opacity="0.85"/>
      <circle cx="${60 + seed % 180}" cy="52" r="30" fill="${c1}" opacity="0.25"/>
      ${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 47 + seed * 13) % 315}" cy="${(i * 31 + seed * 7) % 70}" r="1.4" fill="#EFE6D6" opacity="${0.3 + (i % 3) * 0.2}"/>`).join('')}
      <path d="M0,150 q70,-38 150,-12 q90,30 170,-18 l0,60 l-320,0 z" fill="${c2}" opacity="0.9"/>
      <path d="M0,164 q90,-26 190,2 q80,22 130,-6 l0,20 l-320,0 z" fill="#1F1A14" opacity="0.55"/>
    </svg>`;
  }

  function draw() {
    if (!places.length) {
      grid.replaceChildren(emptyState('Where to, someday?',
        'Add the first place you dream of together.',
        h('button', { class: 'btn btn-primary', onclick: () => edit() }, 'Add the first place')));
      return;
    }
    grid.replaceChildren(...places.map(p => {
      const days = p.targetOn ? Math.ceil((new Date(p.targetOn + 'T12:00:00').getTime() - Date.now()) / 864e5) : null;
      const checklist = safeList(p.checklist);
      const card = h('div', { class: 'card place-card' },
        h('div', { class: 'cover' },
          p.image ? (() => { const im = h('img', { alt: p.name, loading: 'lazy' }); applyMedia(im, p.image); return im; })() : h('div', { class: 'art', html: art(p.name) }),
          h('span', { class: 'status ' + p.status }, p.status)),
        h('div', { class: 'inner' },
          h('h3', {}, p.name + (p.country ? h('span', { class: 'faint small', style: { fontWeight: 400 } }, ' · ' + p.country) : '')),
          p.note ? h('div', { class: 'note' }, '“' + p.note + '”') : '',
          p.dreamDate ? h('div', { class: 'dream' }, p.dreamDate) : '',
          checklist.length ? h('div', { class: 'checklist' }, checklist.map((c, i) => h('label', { class: c.done ? 'done' : '' },
            h('input', { type: 'checkbox', checked: c.done, onchange: async (e) => { checklist[i].done = e.target.checked; await api('PATCH', '/api/places/' + p.id, { checklist }).catch(() => toast('Couldn\'t save that — try again.')); } }), c.t))) : '',
          h('div', { class: 'foot' },
            p.status !== 'visited' && days !== null && days >= 0 ? h('span', { class: 'cd' }, fmtCountdown(new Date(p.targetOn + 'T12:00:00').getTime() - Date.now()) + ' away · ' + fmtDateLong(p.targetOn).replace(/\w/, c => c)) : '',
            p.status === 'visited' && p.visitedOn ? h('span', { class: 'cd', style: { color: 'var(--sage)' } }, '★ visited ' + new Date(p.visitedOn + 'T12:00:00').toLocaleDateString([], { month: 'long', year: 'numeric' })) : '',
            h('span', { style: { display: 'flex', gap: '4px' } },
              h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': 'Edit place', html: icon('edit', 15), onclick: () => edit(p) }),
              h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': 'Change status', html: icon('arrowr', 15), onclick: (e) => statusMenu(p, e.currentTarget) })))));
      return card;
    }));
  }

  function statusMenu(p, anchor) {
    const next = { dreaming: 'planned', planned: 'visited', visited: 'dreaming' };
    showMenuItems([
      { label: '🌙 Dreaming', onclick: () => setStatus(p, 'dreaming') },
      { label: '🗺️ Planned', onclick: () => setStatus(p, 'planned') },
      { label: '✅ Visited — we went!', onclick: async () => { await setStatus(p, 'visited'); } },
      '-',
      { label: 'Remove place', onclick: async () => { await api('DELETE', '/api/places/' + p.id).catch(e => toast(e.message)); load(); } },
    ], anchor);
  }
  async function setStatus(p, status) {
    await api('PATCH', '/api/places/' + p.id, { status }).catch(e => toast(e.message));
    if (status === 'visited') toast('You actually went. Save it to Memories?');
    load();
  }

  function edit(p = null) {
    const name = h('input', { class: 'input', placeholder: 'Paris', maxlength: '80', value: p?.name || '' });
    const country = h('input', { class: 'input', placeholder: 'France', maxlength: '60', value: p?.country || '' });
    const note = h('input', { class: 'input', placeholder: 'Someday.', maxlength: '500', value: p?.note || '' });
    const dream = h('input', { class: 'input', placeholder: 'Rainy October, one umbrella, no plan.', maxlength: '500', value: p?.dreamDate || '' });
    const target = h('input', { class: 'input', type: 'date', value: p?.targetOn || '' });
    let mediaId = p?.image || null;
    const uploadBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
      const fi = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      document.body.append(fi);
      fi.onchange = async () => { const f = fi.files[0]; fi.remove(); if (!f) return;
        try { const md = await uploadMedia(f); mediaId = md.id; uploadBtn.replaceChildren(h('span', { html: icon('check', 15) }), 'Photo attached'); } catch (e) { toast(e.message); } };
      fi.click();
    } }, h('span', { html: icon('image', 15) }), 'Attach a photo');
    modal({ title: p ? 'Edit ' + p.name : 'Add a place', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('Destination', name), field('Country (optional)', country), field('A note', note, '“Someday.” works beautifully.'), field('The dream date', dream), field('Target date (optional)', target), h('div', {}, uploadBtn)),
      actions: [{ label: p ? 'Save' : 'Add to the list', class: 'btn-primary', onclick: async (close) => {
        try {
          const payload = { name: name.value, country: country.value, note: note.value, dreamDate: dream.value, targetOn: target.value || null, image: mediaId };
          if (p) await api('PATCH', '/api/places/' + p.id, payload);
          else await api('POST', '/api/places', payload);
          close(); load();
        } catch (e) { toast(e.message); }
      } }] });
  }

  const safeList = (s) => { try { const v = s || '[]'; return typeof v === 'string' ? JSON.parse(v) : Array.isArray(v) ? v : []; } catch { return []; } };
  function showMenuItems(items, anchor) {
    showMenu(items, anchor);
  }

  offs.push(on('entity:places', () => load()));
  load();
  return { destroy() { offs.forEach(off => off()); } };
}
