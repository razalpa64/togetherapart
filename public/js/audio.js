// Ambient sound engine — synthesized with WebAudio, zero audio files.
// Rain, fireplace, ocean, café, night, wind. Never autoplays; always starts from a gesture.
let ctx = null, master = null, currentId = null, nodes = [], timers = [];
const VOL_KEY = 'ta_vol';

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = getVolume();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function getVolume() { return parseFloat(storage.get(VOL_KEY) ?? '0.6'); }
export function setVolume(v) {
  storage.set(VOL_KEY, String(v));
  if (master) master.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.1);
}

function noiseBuffer(type = 'white') {
  const len = ctx.sampleRate * 2.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'white') d[i] = w * 0.6;
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } // brown
  }
  return buf;
}
function src(type) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(type);
  s.loop = true;
  return s;
}
function chain(...ns) {
  for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]);
  ns[ns.length - 1].connect(master);
  nodes.push(...ns.filter(n => n.start || n.frequency));
  return ns[0];
}

const PRESETS = {
  rain() {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    const g = ctx.createGain(); g.gain.value = 0.32;
    chain(src('white'), hp, lp, g).start();
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 240;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    chain(src('brown'), lp2, g2).start();
  },
  fire() {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const g = ctx.createGain(); g.gain.value = 0.5;
    chain(src('brown'), lp, g).start();
    // crackles
    timers.push(setInterval(() => {
      if (Math.random() < 0.75) {
        const o = ctx.createBufferSource();
        const b = ctx.createBuffer(1, 2400, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
        o.buffer = b;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400 + Math.random() * 2200; bp.Q.value = 1.2;
        const cg = ctx.createGain(); cg.gain.value = 0.05 + Math.random() * 0.09;
        o.connect(bp); bp.connect(cg); cg.connect(master);
        o.start();
        setTimeout(() => { try { o.disconnect(); cg.disconnect(); } catch {} }, 400);
      }
    }, 260));
  },
  ocean() {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0.4;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.22;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    chain(src('brown'), lp, g).start();
    nodes.push(lfo);
  },
  cafe() {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.3;
    chain(src('brown'), bp, g).start();
    timers.push(setInterval(() => { // distant cups & murmurs
      if (Math.random() < 0.4) {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = 1600 + Math.random() * 900;
        const cg = ctx.createGain();
        const t = ctx.currentTime;
        cg.gain.setValueAtTime(0.012, t);
        cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(cg); cg.connect(master);
        o.start(t); o.stop(t + 0.45);
      }
    }, 3000));
  },
  night() {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    const g = ctx.createGain(); g.gain.value = 0.16;
    chain(src('brown'), lp, g).start();
    // crickets
    timers.push(setInterval(() => {
      const t = ctx.currentTime;
      for (let k = 0; k < 4; k++) {
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.value = 4200 + Math.random() * 300;
        const cg = ctx.createGain();
        const st = t + k * 0.09;
        cg.gain.setValueAtTime(0, st);
        cg.gain.linearRampToValueAtTime(0.006, st + 0.02);
        cg.gain.linearRampToValueAtTime(0, st + 0.07);
        o.connect(cg); cg.connect(master);
        o.start(st); o.stop(st + 0.09);
      }
    }, 1400));
  },
  wind() {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const g = ctx.createGain(); g.gain.value = 0.3;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lg = ctx.createGain(); lg.gain.value = 0.15;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    chain(src('brown'), lp, g).start();
    nodes.push(lfo);
  },
};

export const AMBIENCES = [
  { id: 'rain', label: 'Rain', emoji: '🌧️' },
  { id: 'fire', label: 'Fireplace', emoji: '🔥' },
  { id: 'ocean', label: 'Ocean', emoji: '🌊' },
  { id: 'cafe', label: 'Café', emoji: '☕' },
  { id: 'night', label: 'Night', emoji: '🌙' },
  { id: 'wind', label: 'Wind', emoji: '🍃' },
];

export function stop() {
  timers.forEach(clearInterval); timers = [];
  nodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch {} });
  nodes = [];
  currentId = null;
}
export function playing() { return currentId; }
export function toggle(id) { currentId === id ? stop() : play(id); return currentId; }
export function play(id) {
  if (!PRESETS[id]) return null;
  ensure();
  stop();
  PRESETS[id]();
  currentId = id;
  return id;
}
