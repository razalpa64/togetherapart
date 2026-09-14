// ACTIVITIES — the library of things to do together.
import { api } from '../api.js';
import { store, partner, isPremium } from '../state.js';
import { on } from '../bus.js';
import { send } from '../ws.js';
import { h, icon, toast, modal, field } from '../ui.js';
import { renderGame } from '../games/index.js';
import { AMBIENCES, play, stop, playing } from '../audio.js';

export function render(root) {
  const stage = h('div', { class: 'card card-pad', id: 'act-stage', style: { minHeight: '300px' } });
  const library = buildLibrary();

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, 'Things to do, together'),
        h('h1', { class: 'display-2' }, 'Activities'),
        h('p', {}, 'Talk, play, create, watch, listen. All of it synced.'))),
    h('div', { class: 'act-cats' },
      library.map(cat => h('div', { class: 'act-cat' },
        h('div', { class: 'cat-head' }, h('span', { style: { fontSize: '1.3rem' } }, cat.emoji), h('h2', {}, cat.title), h('span', { class: 'small faint' }, cat.blurb)),
        h('div', { class: 'act-grid' }, cat.items.map(item => {
          const locked = item.premium && !isPremium();
          const btn = h('button', { class: 'act-card' + (item.locked ? ' locked' : ''), onclick: () => {
            if (item.locked) return;
            if (item.needsPartner && !partner()) { toast('This one needs two — invite your partner from Our Place.'); return; }
            item.run();
          } },
            h('span', { class: 'e' }, item.emoji),
            h('span', {}, h('div', { class: 'n' }, item.name), h('div', { class: 'd' }, item.desc || '')),
            item.locked ? h('span', { class: 'lockflag' }, 'coming soon') : '',
            locked ? h('span', { class: 'lockflag' }, 'premium') : '');
          return btn;
        }))))),
    stage));

  const showStage = (title, back = true) => {
    stage.replaceChildren();
    stage.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' } },
      back ? h('button', { class: 'icon-btn', 'aria-label': 'Back to activities', html: icon('chevl', 18), onclick: resetStage }) : '',
      h('h2', { class: 'h2' }, title)));
    stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return stage;
  };
  function resetStage() {
    stage.replaceChildren(h('p', { class: 'muted', style: { textAlign: 'center', padding: '60px 20px' } }, 'Pick something above. The good kind of trouble starts there.'));
  }

  const runGame = (game) => () => {
    const box = showStage(({ ttt: 'Tic Tac Toe', c4: 'Connect Four', memory: 'Memory Match', wyr: 'Would You Rather', thisthat: 'This or That', draw: 'The Drawing Game' })[game]);
    const holder = h('div', {});
    box.append(holder);
    renderGame(holder, game, resetStage);
  };

  const runDeck = (deckId, title) => () => {
    const box = showStage(title);
    const cardBox = h('div', { class: 'card card-pad', style: { maxWidth: '480px', margin: '0 auto', textAlign: 'center', minHeight: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' } },
      h('p', { class: 'faint small' }, 'Draw the same card, take your time.'));
    const drawBtn = h('button', { class: 'btn btn-primary', style: { marginTop: '16px' }, onclick: async () => {
      const d = await api('GET', '/api/decks/' + deckId);
      const q = d.deck[Math.floor(Math.random() * d.deck.length)];
      cardBox.replaceChildren(h('p', { class: 'serif', style: { fontSize: '1.35rem', lineHeight: 1.4 } }, Array.isArray(q) ? q.join(' — or — ') : q));
      send({ t: 'song:sync', data: { kind: 'card', deck: deckId, q: Array.isArray(q) ? q.join('|') : q } });
    } }, 'Draw a card');
    box.append(cardBox, h('div', { style: { textAlign: 'center' } }, drawBtn));
    const off = on('ws:song:sync', ({ from, data }) => {
      if (from === store.me.user.id || !data || data.kind !== 'card' || data.deck !== deckId) return;
      cardBox.replaceChildren(h('p', { class: 'serif', style: { fontSize: '1.35rem', lineHeight: 1.4 } }, data.q.split('|').join(' — or — ')));
    });
    stage._cleanup = off;
  };

  function watchTogether() {
    const url = h('input', { class: 'input', placeholder: 'Paste a video link — YouTube, anything' });
    modal({ title: 'Watch something together', body: h('div', {},
      h('p', { class: 'muted small', style: { marginBottom: '14px' } }, 'A synced start: you both press play on the same second. The countdown keeps you honest.'),
      field('Video link', url)),
      actions: [{ label: 'Start the countdown', class: 'btn-primary', onclick: async (close) => {
        if (!url.value.startsWith('http')) { toast('Paste the link to whatever you\'re watching.'); return false; }
        close();
        send({ t: 'song:sync', data: { kind: 'watch', url: url.value } });
        countdownThen(() => window.open(url.value, '_blank', 'noopener'));
      } }] });
  }
  function countdownThen(fn) {
    const count = h('div', { class: 'display', id: 'sync-count', style: { textAlign: 'center', padding: '10px' } }, '3');
    const m = modal({ title: 'Starting together', body: h('div', {}, count, h('p', { class: 'small muted', style: { textAlign: 'center' } }, 'Neither of you peeks early.')) });
    let n = 3;
    const iv = setInterval(() => {
      n--;
      const el = document.getElementById('sync-count');
      if (!el) { clearInterval(iv); return; }
      if (n <= 0) { clearInterval(iv); fn(); m.close(); } else el.textContent = String(n);
    }, 1000);
  }

  function listenTogether() {
    const box = showStage('Listen together');
    box.append(h('p', { class: 'muted small', style: { marginBottom: '12px' } }, 'Ambience for the room — it syncs to both of you.'),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, AMBIENCES.map(a => h('button', { class: 'chip', onclick: async () => {
        await api('PUT', '/api/room', { music: a.id }).catch(() => {});
        play(a.id);
        toast('Playing for both of you.');
      } }, a.emoji + ' ' + a.label))),
      h('button', { class: 'btn btn-ghost btn-sm', style: { marginTop: '16px' }, onclick: async () => { await api('PUT', '/api/room', { music: null }).catch(() => {}); stop(); } }, 'Stop the music'),
      h('div', { class: 'hr' }),
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => location.hash = '#/songs' }, h('span', { html: icon('music', 15) }), 'Our Songs'));
  }

  function buildLibrary() {
    return [
      { emoji: '💬', title: 'Talk', blurb: 'questions worth staying up for', items: [
        { emoji: '🗂️', name: 'Conversation cards', desc: 'gentle starters', run: runDeck('cards', 'Conversation cards'), needsPartner: false },
        { emoji: '🤔', name: 'Would You Rather', desc: 'impossible choices', run: runGame('wyr'), needsPartner: true },
        { emoji: '⚡', name: 'This or That', desc: 'lightning instincts', run: runGame('thisthat'), needsPartner: true },
        { emoji: '🌊', name: 'Deep questions', desc: 'the real ones', run: runDeck('deep', 'Deep questions') },
        { emoji: '🗺️', name: 'Future plans', desc: 'someday, out loud', run: runDeck('future', 'Future plans') },
        { emoji: '🧸', name: 'Childhood memories', desc: 'who you were before', run: runDeck('childhood', 'Childhood memories') },
      ] },
      { emoji: '🎮', title: 'Play', blurb: 'tiny games, real rivalry', items: [
        { emoji: '⭕', name: 'Tic Tac Toe', desc: 'best of many', run: runGame('ttt'), needsPartner: true },
        { emoji: '🔴', name: 'Connect Four', desc: 'it gets serious', run: runGame('c4'), needsPartner: true },
        { emoji: '🧠', name: 'Memory Match', desc: 'pairs & smugness', run: runGame('memory'), needsPartner: true },
        { emoji: '✏️', name: 'Drawing Game', desc: '60 seconds, no talent', run: runGame('draw'), needsPartner: true },
        { emoji: '♟️', name: 'Chess', locked: true, run: () => {} },
        { emoji: '🎯', name: 'Checkers', locked: true, run: () => {} },
      ] },
      { emoji: '🎨', title: 'Create', blurb: 'make things that are yours', items: [
        { emoji: '🖌️', name: 'Shared drawing', desc: 'one canvas, two hands', run: runGame('draw'), needsPartner: true },
        { emoji: '📔', name: 'Couple scrapbook', desc: 'your memories', run: () => { location.hash = '#/memories'; } },
        { emoji: '🎶', name: 'Collaborative playlist', desc: 'your songs', run: () => { location.hash = '#/songs'; } },
        { emoji: '🛋️', name: 'Room decoration', desc: 'make it yours', run: () => { location.hash = '#/place'; } },
      ] },
      { emoji: '🎬', title: 'Watch', blurb: 'same second, same screen', items: [
        { emoji: '📺', name: 'Watch together', desc: 'synced start + reactions', run: watchTogether, needsPartner: true },
      ] },
      { emoji: '🎧', title: 'Listen', blurb: 'soundtrack of you', items: [
        { emoji: '🌧️', name: 'Ambience together', desc: 'rain, fire, ocean…', run: listenTogether },
        { emoji: '💿', name: 'Our Songs', desc: 'the playlist', run: () => { location.hash = '#/songs'; } },
      ] },
    ];
  }

  const offWatch = on('ws:song:sync', ({ from, data }) => {
    if (from === store.me.user.id || !data) return;
    if (data.kind === 'watch' && data.url) {
      toast('They want to watch something with you — right now.', { actionLabel: 'Join', onAction: () => countdownThen(() => window.open(data.url, '_blank', 'noopener')), dur: 15000 });
    }
  });
  resetStage();
  return { destroy() { if (stage._cleanup) stage._cleanup(); offWatch(); } };
}
