// GAMES ARCADE — Dedicated interactive gaming portal for long-distance couples.
import { partner } from '../state.js';
import { h, icon, toast } from '../ui.js';
import { renderGame } from '../games/index.js';

const GAMES_LIST = [
  { id: 'chess', name: 'Chess Duel', emoji: '♟️', category: 'Strategy', desc: 'The classic game of kings and strategy for two.' },
  { id: 'checkers', name: 'Checkers', emoji: '🎯', category: 'Strategy', desc: 'Jump, capture, king your pieces and dominate the board.' },
  { id: 'wordle', name: 'Word Guess Duel', emoji: '🔤', category: 'Puzzle', desc: 'Guess the 6-letter secret word with letter clues together.' },
  { id: 'trivia', name: 'Couple\'s Trivia', emoji: '💡', category: 'Quiz', desc: 'Test how well you know each other with fun relationship trivia.' },
  { id: 'rps', name: 'RPS Spock Duel', emoji: '✌️', category: 'Quick Play', desc: 'Rock Paper Scissors Spock quick decision showdown.' },
  { id: 'ttt', name: 'Tic Tac Toe', emoji: '⭕', category: 'Classic', desc: 'Lightweight best-of-series grid match.' },
  { id: 'c4', name: 'Connect Four', emoji: '🔴', category: 'Classic', desc: 'Line up four discs in a row before your partner does.' },
  { id: 'memory', name: 'Memory Match', emoji: '🧠', category: 'Puzzle', desc: 'Uncover matching card pairs and test your visual memory.' },
  { id: 'wyr', name: 'Would You Rather', emoji: '🤔', category: 'Party', desc: 'Hard choices and funny debate starters.' },
  { id: 'thisthat', name: 'This or That', emoji: '⚡', category: 'Party', desc: 'Fast-paced preference picking duel.' },
  { id: 'draw', name: 'Drawing Game', emoji: '✏️', category: 'Creative', desc: 'Draw prompts on a shared canvas in real time.' },
];

export function render(root) {
  const stage = h('div', { class: 'card card-pad', id: 'games-stage', style: { minHeight: '340px', marginTop: '24px' } });
  
  function resetStage() {
    stage.replaceChildren(
      h('div', { style: { textAlign: 'center', padding: '50px 20px' } },
        h('span', { style: { fontSize: '2.5rem', display: 'block', marginBottom: '12px' } }, '🎮'),
        h('h3', { class: 'h3' }, 'Pick a game to start playing!'),
        h('p', { class: 'muted small', style: { marginTop: '6px' } }, 'All games are synced live between you and your partner.'))
    );
  }

  function launchGame(gameId) {
    if (!partner()) {
      toast('You can explore games or invite your partner from Our Place to play together live!');
    }
    const g = GAMES_LIST.find(x => x.id === gameId);
    stage.replaceChildren();
    const holder = h('div', {});
    stage.append(holder);
    renderGame(holder, gameId, resetStage);
    stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const grid = h('div', { class: 'act-grid', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' } },
    GAMES_LIST.map(g => h('button', {
      class: 'act-card',
      style: { textAlign: 'left', cursor: 'pointer', padding: '18px', borderRadius: '16px', background: 'var(--bg-2)', border: '1px solid var(--border)', transition: 'all 0.2s ease' },
      onclick: () => launchGame(g.id)
    },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' } },
        h('span', { style: { fontSize: '1.8rem' } }, g.emoji),
        h('span', { class: 'tag', style: { fontSize: '0.75rem', padding: '3px 8px', borderRadius: '8px' } }, g.category)),
      h('div', { class: 'n', style: { fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' } }, g.name),
      h('div', { class: 'd', style: { fontSize: '0.85rem', color: 'var(--ink-2)', lineHeight: 1.3 } }, g.desc)
    ))
  );

  root.append(
    h('div', {},
      h('div', { class: 'page-head' },
        h('div', { class: 't' },
          h('span', { class: 'eyebrow' }, '🎮 Couple\'s Playroom'),
          h('h1', { class: 'display-2' }, 'Games Arcade'),
          h('p', {}, '11 real-time, synced games built for long-distance rivals and partners.'))),
      grid,
      stage
    )
  );

  resetStage();
  return { destroy() { if (stage._cleanup) stage._cleanup(); } };
}
