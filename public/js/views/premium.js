// PREMIUM — All features unlocked and free for everyone.
import { h, icon } from '../ui.js';

const FEATURES = [
  ['🛋️', 'Private Couple Room & Customizations', 'Your shared home, live room presence, custom furniture & themes — 100% Unlocked.'],
  ['🌧️', 'All Ambient Locations & Environments', 'Rainy window, balcony, beach sunset, cozy café, cabin fireplace & star rooftop — 100% Unlocked.'],
  ['🕯️', 'Hand-Crafted Cabin & Rooftop Scenes', 'Fireplace embers, starry rooftops, and custom seasonal atmospheres — 100% Unlocked.'],
  ['✉️', 'Sealed Time Capsules & Memory Surprises', 'Wrap letters, photo collections, audio notes, and gifts to open anytime — 100% Unlocked.'],
  ['🪄', 'AI & Smart Date Planner', 'Curated romantic date nights, custom activity generators & surprise plans — 100% Unlocked.'],
  ['🎮', 'Games Arcade', 'Chess, Checkers, Word Guess Duel, Couple Trivia, Tic-Tac-Toe, Connect Four & Memory — 100% Unlocked.'],
];

export function render(root) {
  const rows = FEATURES.map(([ic, name, desc]) => h('div', { class: 'set-row' },
    h('div', { class: 'l', style: { display: 'flex', gap: '14px', alignItems: 'flex-start' } },
      h('span', { style: { fontSize: '1.4rem', minWidth: '32px' } }, ic),
      h('div', {}, h('div', { class: 't', style: { fontWeight: '600', fontSize: '1rem' } }, name), h('div', { class: 'd', style: { marginTop: '2px' } }, desc))),
    h('span', { class: 'chip on', style: { cursor: 'default', background: 'var(--gold-soft)', color: 'var(--gold-dark, #b8860b)', fontWeight: '600' } }, 'Unlocked Free')));

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow', style: { color: 'var(--gold)' } }, '✨ Everything Unlocked'),
        h('h1', { class: 'display-2' }, 'All Premium Perks Free'),
        h('p', {}, 'Every room, game, atmosphere, memory gift, and date planner feature is completely free for you and your partner.'))),
    h('div', { class: 'card card-pad', style: { maxWidth: '680px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h('span', { style: { fontSize: '1.8rem' } }, '👑'),
          h('div', {},
            h('span', { class: 'serif', style: { fontSize: '1.4rem', fontWeight: 'bold' } }, 'Full VIP Unlocked'),
            h('p', { class: 'small muted', style: { margin: 0 } }, 'No paywalls, no subscriptions — just for the two of you.'))),
        h('span', { class: 'tag', style: { background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '0.85rem', padding: '6px 12px', borderRadius: '12px' } }, 'Forever Free')),
      h('div', { class: 'hr' }),
      ...rows,
      h('div', { class: 'hr' }),
      h('div', { style: { textAlign: 'center', padding: '10px 0' } },
        h('p', { class: 'small muted', style: { marginBottom: '14px' } }, 'Distance is hard enough. Enjoy every single feature of your shared space together!'),
        h('a', { class: 'btn btn-primary', href: '#/games' }, h('span', { html: icon('gamepad', 18) }), 'Explore Games Arcade')))));
  return {};
}
