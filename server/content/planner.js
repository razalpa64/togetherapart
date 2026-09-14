// Date planner — a thoughtful rule-based composer (no black box: it's ours, and it works offline).
// The example brief "30 minutes, she's exhausted, something relaxing" should yield a gentle,
// low-effort date like the one below. Energy: 1 = low, 2 = normal, 3 = adventurous.
import { shuffle, pick } from '../lib/util.js';

const MOODS = {
  romantic: { title: 'A QUIET, ROMANTIC DATE', env: 'dinner', opener: 'Light the candles. We\'re doing this properly.' },
  chill: { title: 'AN EASY NIGHT IN', env: 'apartment', opener: 'No plans, no pressure. Just us.' },
  playful: { title: 'GAME NIGHT', env: 'cafe', opener: 'Competitive? Me? Never.' },
  adventurous: { title: 'A LITTLE ADVENTURE', env: 'balcony', opener: 'Tonight we go somewhere new.' },
  deep: { title: 'DEEP WATERS', env: 'rain', opener: 'Let\'s go somewhere honest tonight.' },
  low: { title: 'A LOW ENERGY DATE', env: 'cafe', opener: 'Tired is allowed. Come as you are.' },
  celebration: { title: 'A CELEBRATION', env: 'beach', opener: 'We have something to celebrate.' },
};

// kind: arrive|tea|song|cards|wyr|game|question|photo|sunset|letter|dance|memory|future|draw|gratitude|thisthat
const LIB = [
  { kind: 'tea', icon: '☕', title: 'Make virtual tea together', desc: 'Both of you, a warm drink, cameras or not. Sip and say nothing for a minute.', minutes: 5, moods: ['low','chill','romantic','deep'], energy: 1 },
  { kind: 'cards', icon: '💬', title: 'Answer 3 gentle questions', deck: 'cards', count: 3, desc: 'Soft ones. Skip anything that feels like work tonight.', minutes: 10, moods: ['low','chill','romantic','deep','playful'], energy: 1 },
  { kind: 'song', icon: '🎵', title: 'Listen to one shared song', desc: 'Press play at the same second. Stay on the line until it ends.', minutes: 5, moods: ['low','chill','romantic','deep','celebration'], energy: 1 },
  { kind: 'rain', icon: '🌧️', title: 'Sit together during the rain', desc: 'Just Stay, rain on. Words optional.', minutes: 8, moods: ['low','chill','romantic'], energy: 1 },
  { kind: 'gratitude', icon: '❤️', title: 'End with a gratitude message', desc: 'One thing you\'re grateful for about them. Say it out loud, then send it in writing.', minutes: 4, moods: ['*'], energy: 1, closer: true },
  { kind: 'song', icon: '🎵', title: 'Choose a song for each other', desc: 'No explaining. Just send it, listen, then guess why.', minutes: 10, moods: ['romantic','chill','playful','deep','celebration'], energy: 2 },
  { kind: 'cards', icon: '💬', title: 'Conversation cards', deck: 'cards', count: 5, desc: 'Take turns. Follow the tangents.', minutes: 15, moods: ['chill','romantic','deep','playful'], energy: 2 },
  { kind: 'question', icon: '🌙', title: 'One deep question each', deck: 'deep', count: 2, desc: 'The kind you have to think about before answering.', minutes: 12, moods: ['deep','romantic','chill'], energy: 2 },
  { kind: 'future', icon: '🗺️', title: 'Plan a piece of your future', desc: 'Next visit, next year, next decade — anything goes.', minutes: 12, moods: ['chill','romantic','deep','adventurous','celebration'], energy: 2 },
  { kind: 'memory', icon: '📸', title: 'Walk through three old memories', desc: 'Open Memories, pick three, tell each other the behind-the-scenes.', minutes: 12, moods: ['chill','romantic','deep','celebration'], energy: 1 },
  { kind: 'sunset', icon: '🌇', title: 'Watch the sunset together', desc: 'Find the west window. Watch until the color goes.', minutes: 10, moods: ['romantic','deep','chill','celebration'], energy: 1 },
  { kind: 'game', icon: '⭕', title: 'Tic tac toe — best of five', game: 'ttt', desc: 'Tiny game, disproportionate rivalry.', minutes: 10, moods: ['playful','chill','low'], energy: 2 },
  { kind: 'game', icon: '🔴', title: 'Connect four', game: 'c4', desc: 'It starts friendly. It does not stay friendly.', minutes: 15, moods: ['playful','chill'], energy: 2 },
  { kind: 'game', icon: '🧠', title: 'Memory match', game: 'memory', desc: 'Turn cards, steal matches, stay smug.', minutes: 10, moods: ['playful','chill'], energy: 2 },
  { kind: 'game', icon: '🎯', title: 'Would you rather', game: 'wyr', desc: 'Impossible choices only.', minutes: 12, moods: ['playful','deep','chill'], energy: 2 },
  { kind: 'game', icon: '⚡', title: 'This or that: lightning round', game: 'thisthat', desc: 'No thinking allowed. First instinct wins.', minutes: 8, moods: ['playful','chill','low'], energy: 1 },
  { kind: 'draw', icon: '✏️', title: 'Draw each other in 60 seconds', desc: 'Bad drawings only. Masterpieces get disqualified.', minutes: 10, moods: ['playful','chill','adventurous'], energy: 2 },
  { kind: 'photo', icon: '📷', title: 'Take a couple photo', desc: 'Photo booth, three seconds, no redoing it.', minutes: 6, moods: ['*'], energy: 1 },
  { kind: 'letter', icon: '✉️', title: 'Write a tiny letter', desc: 'Three sentences. Give it to them when the date ends.', minutes: 10, moods: ['romantic','deep','celebration'], energy: 2 },
  { kind: 'dance', icon: '🕺', title: 'Dance to one song', desc: 'Kitchen rules: lights low, judgment suspended.', minutes: 5, moods: ['playful','romantic','celebration'], energy: 3 },
  { kind: 'thisthat', icon: '⚡', title: 'Rapid-fire this or that', desc: 'Ten rounds, one second each.', minutes: 6, moods: ['playful','low','chill'], energy: 1 },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

export function planDate({ minutes = 45, mood = 'chill', energy = 2, notes = '' }) {
  minutes = DURATIONS.includes(Number(minutes)) ? Number(minutes) : Math.min(Math.max(parseInt(minutes) || 45, 15), 180);
  energy = [1, 2, 3].includes(Number(energy)) ? Number(energy) : 2;
  const M = MOODS[mood] || MOODS.chill;

  const eligible = LIB.filter(a =>
    (a.moods.includes('*') || a.moods.includes(mood)) && a.energy <= energy + 1 && !a.closer);
  const pool = shuffle(eligible);

  // Low energy → bias toward the gentle stuff, and keep it short-feeling
  let budget = minutes;
  const steps = [];
  const arrive = { kind: 'arrive', icon: '🚪', title: 'Arrive', desc: M.opener, minutes: 3 };
  steps.push(arrive); budget -= 3;
  const gratitude = LIB.find(a => a.closer);
  budget -= gratitude.minutes; // reserve closer

  const chosen = [];
  for (const a of pool) {
    if (budget < a.minutes) continue;
    if (chosen.some(c => c.kind === a.kind)) continue; // variety
    if (energy === 1 && a.energy > 2) continue;
    chosen.push(a); budget -= a.minutes;
    if (budget <= 8) break;
  }
  // ensure at least 2 activities even for short dates
  if (chosen.length < 2) {
    for (const a of pool) {
      if (chosen.includes(a)) continue;
      if (a.minutes <= Math.max(budget + 5, 10) && a.energy <= energy + 1) { chosen.push(a); budget -= a.minutes; }
      if (chosen.length >= 2) break;
    }
  }
  if (energy === 1) { // gentle order: tea/questions first, song last
    chosen.sort((a, b) => a.energy - b.energy);
  }
  const all = [...chosen, gratitude];
  if (mood === 'low' && !all.some(a => a.kind === 'rain')) {
    const idx = all.length - 1;
    all.splice(idx, 0, { kind: 'rain', icon: '🌧️', title: 'Sit together during the rain', desc: 'Just Stay, rain on. Words optional.', minutes: 8, moods: ['low'], energy: 1 });
  }

  let t = 0;
  const timed = all.map(a => {
    const start = t; t += a.minutes;
    const mm = (n) => String(Math.floor(n)).padStart(2, '0');
    return { ...a, startMin: start, time: `${mm(start)} min` };
  });

  const plan = {
    id: null, title: M.title, mood, energy, minutes, env: M.env, notes: notes.slice(0, 300) || null,
    steps: timed,
    createdWith: 'Planned with the date planner',
  };
  return plan;
}
