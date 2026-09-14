// OUR SONGS — the soundtrack, with a song of the month and play-together ritual.
import { api } from '../api.js';
import { on } from '../bus.js';
import { send } from '../ws.js';
import { h, icon, toast, modal, field, emptyState, floatEmoji } from '../ui.js';

const COVER_COLORS = ['#B4766B', '#B98A44', '#7D8471', '#96525B', '#6E7686', '#8A6844'];

export function render(root) {
  let songs = [];
  const offs = [];
  const list = h('div', { class: 'songs-list' });

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, 'The soundtrack of you'),
        h('h1', { class: 'display-2' }, 'Our Songs'),
        h('p', {}, 'Add them, rank them, crown one for the month.')),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary', onclick: addSong }, h('span', { html: icon('plus', 16) }), 'Add a song'))),
    list));

  async function load() {
    try {
      const d = await api('GET', '/api/songs');
      songs = d.songs;
      draw();
    } catch (e) { toast(e.message); }
  }

  function draw() {
    if (!songs.length) {
      list.replaceChildren(emptyState('What song feels like us?', 'The first one is always the hardest — and the easiest.',
        h('button', { class: 'btn btn-primary', onclick: addSong }, 'Add your first song')));
      return;
    }
    list.replaceChildren(...songs.map((s, i) => {
      const row = h('div', { class: 'song-row' + (s.month ? ' month-song' : '') },
        h('span', { class: 'cover', style: { background: COVER_COLORS[i % COVER_COLORS.length] } }, (s.title || '?').trim()[0]?.toUpperCase() || '♪'),
        h('div', { class: 'info' },
          h('div', { class: 't' }, s.title, ' ', s.month ? h('span', { class: 'month-flag' }, '· song of the month') : ''),
          h('div', { class: 'a' }, s.artist || '—')),
        s.note ? h('div', { class: 'note', title: s.note }, s.note) : '',
        h('div', { class: 'acts' },
          s.link ? h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': 'Play together', html: icon('play', 15), onclick: () => playTogether(s) }) : '',
          h('button', { class: 'icon-btn' + (s.favorite ? ' on' : ''), style: { width: '32px', height: '32px' }, 'aria-label': 'Favorite', html: icon('star', 15), onclick: async () => { await api('PATCH', '/api/songs/' + s.id, { favorite: !s.favorite }).catch(() => {}); } }),
          h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': 'Song of the month', html: icon('crown', 15), onclick: async () => { await api('PATCH', '/api/songs/' + s.id, { month: !s.month }).catch(() => {}); if (!s.month) toast('Crowned. Long live the song of the month.'); } }),
          i > 0 ? h('button', { class: 'icon-btn', style: { width: '28px', height: '28px' }, 'aria-label': 'Move up', html: icon('chevl', 13), onclick: async () => { await api('PATCH', '/api/songs/' + s.id, { move: 'up' }).catch(() => {}); } }) : '',
          i < songs.length - 1 ? h('button', { class: 'icon-btn', style: { width: '28px', height: '28px' }, 'aria-label': 'Move down', html: icon('chevr', 13), onclick: async () => { await api('PATCH', '/api/songs/' + s.id, { move: 'down' }).catch(() => {}); } }) : '',
          h('button', { class: 'icon-btn', style: { width: '32px', height: '32px' }, 'aria-label': 'Delete song', html: icon('trash', 15), onclick: async () => { await api('DELETE', '/api/songs/' + s.id).catch(e => toast(e.message)); } })));
      row.onclick = (e) => { if (e.target.closest('button')) return; detail(s); };
      return row;
    }));
  }

  function detail(s) {
    modal({ title: s.title, body: h('div', {},
      h('p', { class: 'muted' }, s.artist || 'Unknown artist'),
      s.note ? h('p', { class: 'small', style: { marginTop: '10px', fontStyle: 'italic' } }, '“' + s.note + '”') : '',
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '18px', flexWrap: 'wrap' } },
        s.link ? h('a', { class: 'btn btn-ghost btn-sm', href: s.link, target: '_blank', rel: 'noopener' }, h('span', { html: icon('link', 14) }), 'Open song') : '',
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async (e) => { await api('POST', '/api/memories', { type: 'song', title: s.title, body: s.note, songTitle: s.title, songArtist: s.artist, happenedOn: new Date().toISOString().slice(0, 10) }); toast('Saved to Memories with the song.'); } }, h('span', { html: icon('image', 14) }), 'Attach to memories'))),
      actions: [] });
  }

  function addSong() {
    const title = h('input', { class: 'input', placeholder: 'Wherever You Will Go', maxlength: '120' });
    const artist = h('input', { class: 'input', placeholder: 'The Calling', maxlength: '120' });
    const link = h('input', { class: 'input', placeholder: 'https://… (YouTube, Spotify — anything)', value: '' });
    const note = h('input', { class: 'input', placeholder: 'You hummed this on call once', maxlength: '300' });
    modal({ title: 'Add a song', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('Title', title), field('Artist', artist), field('Link (optional)', link), field('Why this one? (optional)', note)),
      actions: [{ label: 'Add to our songs', class: 'btn-primary', onclick: async (close) => {
        if (!title.value.trim()) { toast('It needs a name, at least.'); return false; }
        try { await api('POST', '/api/songs', { title: title.value, artist: artist.value, link: link.value.startsWith('http') ? link.value : null, note: note.value }); close(); load(); }
        catch (e) { toast(e.message); }
      } }] });
  }

  // Play-together: a 3-2-1 synced start ritual, then everyone opens the song.
  function playTogether(s) {
    const count = h('div', { style: { textAlign: 'center', padding: '20px 0' } },
      h('div', { class: 'display-2', id: 'sync-count' }, '3'),
      h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'Press play together. Neither of you peeks early.'));
    const m = modal({ title: '♪ ' + s.title, body: count, actions: [{ label: 'Cancel', class: 'btn-ghost', onclick: () => {} }] });
    send({ t: 'song:sync', data: { kind: 'invite', songId: s.id, title: s.title, link: s.link } });
    let n = 3;
    const iv = setInterval(() => {
      n--;
      const el = document.getElementById('sync-count');
      if (!el) { clearInterval(iv); return; }
      if (n <= 0) {
        clearInterval(iv);
        el.textContent = '▶ now';
        if (s.link) window.open(s.link, '_blank', 'noopener');
        floatEmoji('🎵');
        setTimeout(() => m.close(), 1200);
      } else el.textContent = String(n);
    }, 1000);
  }

  offs.push(on('entity:songs', () => load()));
  offs.push(on('ws:song:sync', ({ from, data }) => {
    if (from === store.me.user.id || !data) return;
    if (data.kind === 'invite') {
      toast('They want to play “' + (data.title || 'a song') + '” with you — right now.', { actionLabel: 'Join', onAction: () => {
        send({ t: 'song:sync', data: { kind: 'accepted' } });
        if (data.link) window.open(data.link, '_blank', 'noopener');
      }, dur: 12000 });
    }
  }));
  load();
  return { destroy() { offs.forEach(off => off()); } };
}
