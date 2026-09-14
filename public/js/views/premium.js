// PREMIUM — quiet, honest, never pushy. The free world stays whole.
import { api } from '../api.js';
import { store, refreshMe, isPremium, coupleIsDemo } from '../state.js';
import { h, icon, toast } from '../ui.js';

const FEATURES = [
  ['🛋️', 'Your private couple room', true, 'The room, presence, Just Stay, chat and memories — always free, always whole.'],
  ['🌧️', 'All the quiet places', true, 'Rain, balcony, beach, café and the cozy apartment in Just Stay.'],
  ['🕯️', 'Cabin & rooftop scenes', false, 'Two hand-drawn premium environments — fireplace embers, rooftops under stars.'],
  ['✉️', 'Sealed surprises', true, 'Letters, gifts and date invitations that open exactly when they should.'],
  ['📸', 'Memory surprises', false, 'Wrap a collection of your moments as one gift that unlocks later.'],
  ['wand', 'The date planner', true, 'Moods, minutes, gentle evenings — planned in seconds.'],
  [' roomId', 'Expanded customization', false, 'More looks for your room and yourselves, as your world grows.'],
];

export function render(root) {
  const premium = isPremium();
  const rows = FEATURES.map(([ic, name, free, desc]) => h('div', { class: 'set-row' },
    h('div', { class: 'l', style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } },
      h('span', { style: { fontSize: '1.15rem', minWidth: '26px' } }, ic.startsWith('wand') || ic.includes('roomId') ? (ic.includes('wand') ? '🪄' : '🛋️') : ic),
      h('div', {}, h('div', { class: 't' }, name), h('div', { class: 'd' }, desc))),
    h('span', { class: 'chip' + (free ? '' : ' on'), style: { cursor: 'default' } }, free ? 'Free' : 'Premium')));

  const toggle = h('button', { class: 'btn ' + (premium ? 'btn-ghost' : 'btn-primary'), onclick: async () => {
    await api('PATCH', '/api/couple', { plan: premium ? 'free' : 'premium' });
    await refreshMe();
    toast(premium ? 'Back to free — still everything that matters.' : 'Premium on. The cabin is warm.');
    location.hash = '#/settings'; setTimeout(() => location.hash = '#/premium', 10);
  } }, premium ? 'Turn premium off (demo)' : 'Try premium — free in this build');

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, 'Keeping the lights on'),
        h('h1', { class: 'display-2' }, 'Premium'),
        h('p', {}, 'The free world is the whole product. Premium just adds rooms to it.'))),
    h('div', { class: 'card card-pad', style: { maxWidth: '640px' } },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' } },
        h('span', { class: 'tag', style: { color: premium ? 'var(--gold)' : 'var(--ink-3)' } }, premium ? 'your plan' : 'current plan'),
        h('span', { class: 'serif', style: { fontSize: '1.5rem' } }, premium ? 'Premium' : 'Free')),
      h('div', { class: 'hr' }),
      ...rows,
      h('div', { class: 'hr' }),
      h('p', { class: 'small muted', style: { marginBottom: '14px' } },
        'In production this is a subscription (a couple, one plan — one price for two). In this build, it\'s a switch so you can see everything.'),
      coupleIsDemo() ? h('p', { class: 'small faint' }, 'The demo world ships with premium on.') : '',
      toggle)));
  return {};
}
