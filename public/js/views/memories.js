// OUR MEMORIES — the timeline of a life together, kept warm.
import { api, uploadMedia, mediaUrl } from '../api.js';
import { applyMedia } from '../ui.js';
import { store } from '../state.js';
import { on } from '../bus.js';
import { h, icon, toast, modal, field, emptyState, fmtDateLong } from '../ui.js';

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'photo', label: 'Photos' },
  { id: 'milestone', label: 'Milestones' },
  { id: 'date', label: 'Dates' },
  { id: 'note', label: 'Notes' },
  { id: 'song', label: 'Songs' },
  { id: 'voice', label: 'Voice' },
];
const TYPE_ICON = { photo: '📷', milestone: '❤️', date: '🌙', note: '📝', song: '🎵', voice: '🎙️' };

export function render(root) {
  let memories = [];
  let filter = 'all';
  const offs = [];
  const grid = h('div', {});
  const addBtn = h('button', { class: 'btn btn-primary', onclick: () => addMemory() }, h('span', { html: icon('plus', 16) }), 'Save a memory');

  const chips = h('div', { class: 'mem-filters', role: 'tablist', 'aria-label': 'Filter memories' },
    FILTERS.map(f => h('button', { class: 'chip' + (f.id === 'all' ? ' on' : ''), role: 'tab', 'aria-selected': String(f.id === filter), onclick: (e) => { filter = f.id; chips.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on'); draw(); } }, f.label)));

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' }, h('span', { class: 'eyebrow' }, 'Everything you keep'), h('h1', { class: 'display-2' }, 'Our Memories')),
      h('div', { class: 'actions' }, addBtn)),
    chips, grid));

  async function load() {
    try {
      const d = await api('GET', '/api/memories');
      memories = d.memories;
      draw();
    } catch (e) { toast(e.message); }
  }

  function draw() {
    const list = filter === 'all' ? memories : memories.filter(m => m.type === filter);
    if (!list.length) {
      grid.replaceChildren(emptyState(filter === 'all' ? 'No memories yet.' : 'Nothing here yet.',
        filter === 'all' ? 'Make your first one tonight.' : 'It\'ll fill up as you go.',
        filter === 'all' ? h('button', { class: 'btn btn-primary', onclick: () => addMemory() }, 'Save your first memory') : null));
      return;
    }
    grid.replaceChildren(h('div', { class: 'mem-list' },
      ...group(list).map(([month, items]) => h('div', { class: 'mem-month' },
        h('div', { class: 'tag', style: { marginBottom: '10px' } }, month),
        ...items.map(memItem)))));
  }

  function group(list) {
    const byMonth = new Map();
    for (const m of list) {
      const d = new Date((m.happenedOn || '').slice(0, 10) + 'T12:00:00');
      const key = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(m);
    }
    return [...byMonth.entries()];
  }

  function memItem(m) {
    const item = h('div', { class: 'mem-item', role: 'button', tabindex: '0', onclick: () => detail(m), onkeydown: (e) => { if (e.key === 'Enter') detail(m); } },
      m.media
        ? (() => { const im = h('img', { class: 'ph', alt: m.title, loading: 'lazy' }); applyMedia(im, m.media); return im; })()
        : h('span', { class: 'ph', 'aria-hidden': 'true' }, TYPE_ICON[m.type] || '📝'),
      h('div', { class: 'body' },
        h('h3', { class: 'h3' }, m.title),
        m.body ? h('p', {}, m.body) : '',
        h('div', { class: 'meta' },
          h('span', {}, new Date((m.happenedOn || '') + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })),
          m.type === 'song' && m.songTitle ? h('span', {}, '♪ ' + m.songTitle + (m.songArtist ? ' — ' + m.songArtist : '')) : '',
          m.pinned ? h('span', { class: 'pin' }, '★ pinned') : '',
          h('span', { style: { marginLeft: 'auto' } }, 'by ' + (m.author === store.me.user.id ? 'you' : (store.me.partner?.displayName || 'them'))))));
    return item;
  }

  function detail(m) {
    const body = h('div', { class: 'mem-detail' },
      m.media ? (() => { const im = h('img', { class: 'full', alt: m.title }); applyMedia(im, m.media); return im; })() : '',
      h('div', { class: 'tag', style: { marginBottom: '6px' } }, TYPE_ICON[m.type] + ' ' + m.type + ' · ' + new Date((m.happenedOn || '') + 'T12:00:00').toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })),
      h('h2', { class: 'display-2', style: { fontSize: '1.6rem' } }, m.title),
      m.body ? h('p', { class: 'muted', style: { marginTop: '10px', whiteSpace: 'pre-wrap' } }, m.body) : '',
      m.songTitle ? h('p', { class: 'small', style: { marginTop: '10px' } }, '♪ ' + m.songTitle + (m.songArtist ? ' — ' + m.songArtist : '')) : '');
    modal({ title: '', body, wide: true, actions: [
      { label: (m.pinned ? 'Unpin' : 'Pin to the wall'), class: 'btn-ghost', onclick: async () => { await api('PATCH', '/api/memories/' + m.id, { pinned: !m.pinned }); load(); } },
      { label: 'Delete', class: 'btn-danger', onclick: async () => { await api('DELETE', '/api/memories/' + m.id).catch(e => toast(e.message)); load(); } },
      { label: 'Close', class: 'btn-primary', onclick: () => {} },
    ] });
  }

  function addMemory(preset = {}) {
    const typeSel = h('div', { class: 'seg', role: 'radiogroup' },
      ['photo', 'note', 'milestone', 'song', 'date'].map(t => h('button', { class: t === (preset.type || 'photo') ? 'on' : '', role: 'radio', onclick: (e) => { typeSel.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, TYPE_ICON[t] + ' ' + t[0].toUpperCase() + t.slice(1))));
    const title = h('input', { class: 'input', placeholder: 'First virtual date', maxlength: '120', value: preset.title || '' });
    const when = h('input', { class: 'input', type: 'date', value: preset.happenedOn || new Date().toISOString().slice(0, 10) });
    const note = h('textarea', { class: 'input', placeholder: 'What happened? What did it feel like?', value: preset.body || '' });
    const songTitle = h('input', { class: 'input', placeholder: 'Song title', value: preset.songTitle || '' });
    const songArtist = h('input', { class: 'input', placeholder: 'Artist', value: preset.songArtist || '' });
    let mediaId = preset.media || null;
    const uploadBtn = h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
      const fi = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
      document.body.append(fi);
      fi.onchange = async () => {
        const f = fi.files[0]; fi.remove();
        if (!f) return;
        try { const md = await uploadMedia(f); mediaId = md.id; uploadBtn.replaceChildren(h('span', { html: icon('check', 15) }), 'Photo attached'); }
        catch (e) { toast(e.message); }
      };
      fi.click();
    } }, h('span', { html: icon('image', 15) }), 'Attach a photo');
    const songFields = h('div', { class: 'field-wrap', style: { display: 'none', flexDirection: 'column', gap: '10px' } }, field('Song', songTitle), field('Artist', songArtist));
    typeSel.querySelectorAll('button').forEach(b => b.addEventListener('click', (e) => {
      typeSel.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      e.currentTarget.classList.add('on');
      songFields.style.display = b.textContent.includes('Song') ? 'flex' : 'none';
    }));
    modal({ title: 'Save a memory', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('What kind?', typeSel),
      field('Give it a name', title),
      field('When did it happen?', when),
      field('The story', note),
      songFields,
      h('div', {}, uploadBtn)),
      actions: [{ label: 'Keep it', class: 'btn-primary', onclick: async (close) => {
        const type = typeSel.querySelector('.on')?.textContent.toLowerCase().replace(/[^a-z]/g, '') || 'note';
        try {
          await api('POST', '/api/memories', { type, title: title.value, body: note.value, happenedOn: when.value, media: mediaId, songTitle: songTitle.value, songArtist: songArtist.value });
          close(); load();
        } catch (e) { toast(e.message); }
      } }] });
  }

  offs.push(on('entity:memories', () => load()));
  load();
  return { destroy() { offs.forEach(off => off()); } };
}
