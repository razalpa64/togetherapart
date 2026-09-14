// OUR PLACE — the room, presence, moods, countdowns.
import { api } from '../api.js';
import { store, partner, isPremium } from '../state.js';
import { storage } from '../storage.js';
import { on, emit } from '../bus.js';
import { send } from '../ws.js';
import { h, icon, toast, showMenu, modal, field, emptyState, fmtCountdown, fmtDateLong, timeAgo, copyText, floatEmoji } from '../ui.js';
import { sceneTemplate, SPOTS, avatarFigure } from '../room-scene.js';
import { openStay, initStayInvites } from '../stay.js';
import { play, stop, playing, AMBIENCES } from '../audio.js';
import { mediaUrl } from '../api.js';

const MOODS_URL = '/api/decks/moods';
let moodCache = null;

export function render(root, params) {
  let countdowns = [];
  let memoriesPinned = [];
  const offs = [];

  const title = h('div', { class: 't' },
    h('span', { class: 'eyebrow' }, 'Your shared room'),
    h('h1', { class: 'display-2', style: { margin: '6px 0 4px' } }, 'Our Place'));
  const stayBtn = h('button', { class: 'room-stay-btn', onclick: () => openStay() }, 'JUST STAY ', h('span', { 'aria-hidden': 'true' }, '❤️'));
  const head = h('div', { class: 'page-head', style: { paddingTop: '6px' } }, title,
    h('div', { class: 'actions' }, stayBtn));

  const roomWrap = h('div', { class: 'room-wrap', id: 'room-wrap', 'aria-label': 'The room' });
  roomWrap.innerHTML = sceneTemplate();
  const svg = roomWrap.querySelector('#room-svg');

  const partnerPill = h('div', { class: 'room-pill', id: 'room-partner-pill' });
  const musicChip = h('button', { class: 'room-pill', id: 'room-music-chip', style: { display: 'none' }, onclick: () => listenToRoomMusic() });
  const hud = h('div', { class: 'room-hud' },
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, partnerPill, musicChip),
    h('div', { style: { display: 'flex', gap: '8px' } },
      h('button', { class: 'room-pill', onclick: () => inviteMenu(), 'aria-label': 'Interact with the room' }, 'Tap around — everything means something')));

  const foot = h('div', { class: 'room-foot' },
    h('div', { class: 'room-legend' }, 'The window changes the weather. The lamp changes the hour. The tea is always warm.'));

  const moodPanel = h('div', { class: 'card card-pad', id: 'mood-panel' });
  const cdPanel = h('div', { class: 'card card-pad', id: 'cd-panel' });
  const soloBanner = h('div', {});

  roomWrap.append(hud);
  const page = h('section', { style: { padding: 'clamp(18px, 3.4vw, 36px)', maxWidth: '1160px', margin: '0 auto' } },
    head, roomWrap, foot,
    soloBanner,
    h('div', { class: 'two-col', style: { marginTop: '26px' } }, moodPanel, cdPanel));
  root.append(page);

  initStayInvites();
  roomWrap.addEventListener('mouseenter', () => svg.classList.add('rm-spots-show'));
  roomWrap.addEventListener('mouseleave', () => svg.classList.remove('rm-spots-show'));

  /* ---------- room state ---------- */
  function autoScene() {
    const h = new Date().getHours();
    return h >= 20 || h < 6 ? 'night' : h >= 17 ? 'dusk' : 'day';
  }
  function applyRoom() {
    const r = store.room || {};
    const win = !r.window || r.window === 'auto' ? autoScene() : r.window;
    svg.classList.remove('scene-day', 'scene-dusk', 'scene-night', 'scene-rain');
    svg.classList.add('scene-' + win);
    svg.classList.toggle('room-lamp-on', r.lamp !== false);
    svg.classList.toggle('room-candle-on', r.candle !== false);
    svg.classList.toggle('room-tea-on', r.tea !== false);
    svg.classList.toggle('room-music-on', !!r.music);
    updateMusicChip();
  }
  async function patchRoom(patch) {
    Object.assign(store.room, patch);
    applyRoom();
    try { await api('PUT', '/api/room', patch); } catch (e) { toast(e.message); }
  }

  /* ---------- avatars ---------- */
  const avatarsG = svg.querySelector('#avatars');
  const meId = store.me.user.id;
  let mySpot = 'sofaL', theirSpot = 'sofaR';
  function placeAvatar(userId, spot, person, isMe) {
    let g = svg.querySelector('#av-' + (isMe ? 'me' : 'them'));
    const s = SPOTS[spot] || SPOTS.sofaL;
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'rm-avatar');
      g.setAttribute('id', 'av-' + (isMe ? 'me' : 'them'));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      avatarsG.append(g);
    }
    g.innerHTML = avatarFigure(person, isMe);
    g.setAttribute('transform', `translate(${s.x},${s.y - 6})`);
    g.setAttribute('aria-label', (person.displayName || person.name) + (isMe ? ' (you)' : ' — tap to interact'));
    if (!isMe) g.onclick = () => interactionMenu();
    else g.onclick = () => toast('That\'s you. Tap a dashed seat to move, or tap your partner to interact.');
    return g;
  }
  function renderAvatars() {
    const meP = { name: store.me.user.member?.displayName || store.me.user.name, accent: store.me.user.member?.accent || 'rose', hair: store.me.user.member?.hair || 'short' };
    placeAvatar(meId, mySpot, meP, true);
    const p = partner();
    if (p) {
      const pres = store.presence[p.userId];
      placeAvatar(p.userId, theirSpot, { name: p.displayName || p.name, accent: p.accent, hair: p.hair }, false);
      const g = svg.querySelector('#av-them');
      g.classList.toggle('status-away', !pres?.online || pres?.state === 'away');
      const dot = g.querySelector('.av-dot');
      if (dot) { dot.style.fill = !pres?.online ? 'var(--ink-3)' : pres.state === 'just_staying' ? 'var(--rose-2)' : 'var(--ok)'; }
    } else {
      const g = svg.querySelector('#av-them');
      if (g) g.remove();
    }
    renderPartnerPill();
  }
  function renderPartnerPill() {
    const p = partner();
    if (!p) {
      partnerPill.replaceChildren(h('span', { class: 'dot off' }), h('span', {}, 'waiting for ' + (store.me.couple.name.split('&')[1] || 'your partner').trim()));
      return;
    }
    const pres = store.presence[p.userId];
    const online = pres?.online;
    const state = !online ? 'away' : pres.state === 'just_staying' ? 'just staying' : pres.activity || pres.state || 'online';
    partnerPill.replaceChildren(h('span', { class: 'dot' + (online ? '' : ' off') }),
      h('span', {}, p.displayName + ' · ' + state));
  }

  /* ---------- object interactions ---------- */
  const hit = (id) => svg.querySelector('#' + id);
  const bind = (id, fn) => { const el = hit(id); if (el) { el.onclick = fn; el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; } };

  bind('hit-window', () => {
    const order = ['auto', 'day', 'dusk', 'night', 'rain'];
    const cur = store.room?.window || 'auto';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    patchRoom({ window: next });
    roomToast(next === 'auto' ? 'Following your sky' : next === 'day' ? 'Morning light' : next === 'dusk' ? 'Golden hour' : next === 'night' ? 'Night has fallen' : 'Let it rain');
  });
  bind('hit-lamp', () => { const on = !(store.room?.lamp !== false); patchRoom({ lamp: !on }); roomToast(on ? 'Lights low' : 'Lamp on'); });
  bind('hit-candle', () => { const on = !(store.room?.candle !== false); patchRoom({ candle: !on }); roomToast(on ? 'Candle out' : 'Candle lit'); });
  bind('hit-tea', () => { const on = !(store.room?.tea !== false); patchRoom({ tea: !on }); if (!on) { send({ t: 'float', emoji: '☕' }); floatEmoji('☕'); } roomToast(on ? 'Tea cooled' : 'Two cups, still warm'); });
  bind('hit-cat', () => { send({ t: 'float', emoji: '🐾' }); floatEmoji('🐾'); roomToast('The cat approves of you two.'); });
  bind('hit-plant', () => { send({ t: 'float', emoji: '🌿' }); floatEmoji('🌿'); roomToast('It\'s growing. Like some things do.'); });
  bind('hit-shelf', () => { location.hash = '#/memories'; });
  bind('hit-player', () => openMusicSheet());
  for (const fid of ['hit-frame1', 'hit-frame2', 'hit-frame3']) bind(fid, () => openFrames());

  svg.querySelectorAll('.rm-spot-hit').forEach(el => {
    const spot = el.dataset.spot;
    el.onclick = () => { mySpot = spot; renderAvatars(); send({ t: 'avatar:move', spot }); };
    el.onkeydown = (e) => { if (e.key === 'Enter') el.onclick(); };
  });

  function roomToast(text) {
    roomWrap.querySelectorAll('.room-toast').forEach(t => t.remove());
    const t = h('div', { class: 'room-toast' }, text);
    roomWrap.append(t);
    setTimeout(() => t.remove(), 3400);
  }

  async function openMusicSheet() {
    const body = h('div', {},
      h('p', { class: 'muted small', style: { marginBottom: '14px' } }, 'Ambience for the room — both of you hear it, if you\'ve got sound on.'),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        AMBIENCES.map(a => h('button', {
          class: 'chip' + (store.room?.music === a.id ? ' on' : ''),
          onclick: async (e) => {
            const on = store.room?.music === a.id;
            await patchRoom({ music: on ? null : a.id });
            if (on) stop(); else { play(a.id); storage.set('ta_last_amb', a.id); }
            e.currentTarget.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
            if (!on) e.currentTarget.classList.add('on');
            updateSoundIcon();
          },
        }, a.emoji + ' ' + a.label))),
      h('div', { class: 'hr' }),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { m.close(); location.hash = '#/songs'; } }, h('span', { html: icon('music', 15) }), 'Our Songs'));
    const m = modal({ title: 'The record player', body });
  }
  function listenToRoomMusic() {
    const id = store.room?.music;
    if (!id) return;
    play(id);
    storage.set('ta_last_amb', id);
    updateSoundIcon();
    musicChip.style.display = 'none';
  }
  function updateMusicChip() {
    const id = store.room?.music;
    if (id && playing() !== id) {
      const a = AMBIENCES.find(x => x.id === id);
      musicChip.style.display = '';
      musicChip.replaceChildren(h('span', {}, a?.emoji || '🎧'), h('span', {}, 'they put on ' + (a?.label.toLowerCase() || 'music') + ' — tap to listen'));
    } else musicChip.style.display = 'none';
  }

  async function openFrames() {
    const d = await api('GET', '/api/memories').catch(() => null);
    if (!d) return toast('Couldn\'t reach your memories just now.');
    const withMedia = d.memories.filter(m => m.media);
    if (!withMedia.length) {
      modal({ title: 'The frames are waiting', body: h('div', {},
        h('p', { class: 'muted' }, 'Every photo you pin to Memories shows up here, on your wall. Pin your first one and watch this room become yours.'),
        h('button', { class: 'btn btn-primary', style: { marginTop: '16px' }, onclick: () => { m.close(); location.hash = '#/memories'; } }, 'Go to Memories')) });
      const m = null;
      return;
    }
    const mm = modal({ title: 'Your wall', body: h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' } },
      withMedia.slice(0, 6).map(m => h('button', { style: { position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '1', cursor: 'pointer' }, onclick: () => { mm.close(); location.hash = '#/memories'; } },
        (() => { const im = h('img', { alt: m.title, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }); applyMedia(im, m.media); return im; })()))) });
  }
  async function setFrames() {
    const d = await api('GET', '/api/memories').catch(() => null);
    if (!d) return;
    const withMedia = d.memories.filter(m => m.media).slice(0, 3);
    withMedia.forEach((m, i) => {
      const im = svg.querySelector('#frame-img-' + (i + 1));
      const art = svg.querySelector('#frame-art-' + (i + 1));
      if (im) { applyMedia(im, m.media); im.style.display = ''; }
      if (art && im) art.style.display = 'none';
    });
  }

  function interactionMenu() {
    const p = partner();
    if (!p) return toast('They haven\'t arrived yet — the invitation is waiting.');
    const acts = [
      ['wave', 'Wave 👋'], ['hug', 'Hug 🤗'], ['hands', 'Hold hands 🤝'], ['highfive', 'High five ✋'],
      ['fistbump', 'Fist bump 👊'], ['heart', 'Send a heart ❤️'], ['flower', 'Send a flower 🌷'], ['headpat', 'Head pat'], ['dance', 'Dance 💃'],
    ];
    showMenu(acts.map(([type, label]) => ({ label, onclick: () => doInteraction(type) })), svg.querySelector('#av-them'));
  }
  function doInteraction(type) {
    send({ t: 'interaction', type });
    const me = svg.querySelector('#av-me');
    const them = svg.querySelector('#av-them');
    if (type === 'wave' && me) { me.classList.add('waving'); setTimeout(() => me.classList.remove('waving'), 2600); }
    if (type === 'hug' || type === 'hands') {
      [me, them].forEach(g => { if (g) { g.classList.add('hugging'); setTimeout(() => g.classList.remove('hugging'), 1700); } });
    }
    if (type === 'heart') floatEmoji('❤️');
    if (type === 'flower') floatEmoji('🌷');
    if (type === 'dance') floatEmoji('🎶');
  }

  /* ---------- solo banner ---------- */
  function renderSolo() {
    if (partner()) { soloBanner.replaceChildren(); return; }
    const other = (store.me.couple.name.split('&')[1] || 'your partner').trim();
    soloBanner.replaceChildren(h('div', { class: 'card card-pad', style: { marginTop: '22px', display: 'flex', gap: '18px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderStyle: 'dashed' } },
      h('div', {},
        h('h2', { class: 'h2' }, 'Waiting for ' + other),
        h('p', { class: 'muted small', style: { marginTop: '4px' } }, 'Your world is ready — it just needs its second resident.')),
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-primary btn-sm', onclick: () => copyText(store.me.couple.inviteCode, 'Code copied') }, h('span', { html: icon('copy', 15) }), 'Copy invite code'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => copyText(location.origin + '/app#/auth?mode=join&code=' + store.me.couple.inviteCode, 'Invite link copied') }, h('span', { html: icon('share', 15) }), 'Share invitation'))));
  }

  /* ---------- mood panel ---------- */
  async function renderMoodPanel() {
    if (!moodCache) { try { moodCache = (await api('GET', MOODS_URL)).deck; } catch { moodCache = []; } }
    const p = partner();
    const myMood = store.moods[meId]?.mood || null;
    const theirMood = p ? (store.moods[p.userId]?.mood ?? null) : null;
    const moodOf = (id) => moodCache.find(m => m.id === id);

    const mine = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      moodCache.map(m => h('button', {
        class: 'chip' + (myMood === m.id ? ' on' : ''),
        onclick: async () => { await api('PUT', '/api/mood', { mood: myMood === m.id ? null : m.id }).catch(e => toast(e.message)); },
      }, m.emoji + ' ' + m.label)));

    const theirs = p
      ? h('div', { class: 'soft-card', style: { marginTop: '14px' } },
          theirMood && moodOf(theirMood)
            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
                h('span', { style: { fontSize: '1.5rem' } }, moodOf(theirMood).emoji),
                h('div', {}, h('div', { style: { fontWeight: 600 } }, p.displayName + ' is feeling ' + moodOf(theirMood).label.toLowerCase()), h('div', { class: 'tiny faint' }, timeAgo(store.moods[p.userId]?.updatedAt || Date.now()))),
                h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                  h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { send({ t: 'interaction', type: 'hug' }); floatEmoji('🤗'); } }, 'Send hug'),
                  h('button', { class: 'btn btn-ghost btn-sm', onclick: () => location.hash = '#/chat' }, 'Message'),
                  h('button', { class: 'btn btn-ghost btn-sm', onclick: () => location.hash = '#/surprises' }, 'Leave a note'),
                  store.presence[p.userId]?.state === 'just_staying' ? h('button', { class: 'btn btn-rose btn-sm', onclick: () => openStay({ invite: true }) }, 'Join them') : ''))
            : h('div', { class: 'small muted' }, p.displayName + ' hasn\'t set a mood — no pressure.'))
      : h('div', { class: 'small muted', style: { marginTop: '14px' } }, 'Moods appear here once ' + (store.me.couple.name.split('&')[1] || 'they').trim() + ' joins.');

    moodPanel.replaceChildren(
      h('span', { class: 'eyebrow' }, 'Moods'),
      h('h2', { class: 'h2', style: { margin: '8px 0 12px' } }, 'How are you, really?'),
      mine, theirs,
      h('p', { class: 'tiny faint', style: { marginTop: '12px' } }, 'Silent, gentle, no noise unless it matters.'));
  }

  /* ---------- countdown panel ---------- */
  async function renderCdPanel() {
    const d = await api('GET', '/api/countdowns').catch(() => null);
    countdowns = d ? d.countdowns : [];
    const future = countdowns.filter(c => c.targetAt > Date.now());
    const next = future[0];
    const addBtn = h('button', { class: 'btn btn-subtle btn-sm', onclick: addCountdown }, h('span', { html: icon('plus', 15) }), 'Plan something');
    if (!next) {
      cdPanel.replaceChildren(h('span', { class: 'eyebrow' }, 'Looking forward'),
        h('h2', { class: 'h2', style: { margin: '8px 0 4px' } }, 'Nothing on the horizon.'),
        h('p', { class: 'muted small' }, 'Countdowns live here — the next call, the next visit, the next everything.'),
        h('div', { style: { marginTop: '14px' } }, addBtn));
      return;
    }
    cdPanel.replaceChildren(
      h('span', { class: 'eyebrow' }, 'Looking forward'),
      h('div', { class: 'countdown-hero' },
        h('div', { style: { fontSize: '2rem' } }, next.icon || '✈️'),
        h('div', { class: 'num' }, fmtCountdown(next.targetAt - Date.now()).replace(' days', '')),
        h('div', { class: 'lbl' }, fmtCountdown(next.targetAt - Date.now()).startsWith('1 day') ? 'day' : 'days ' + next.label),
        h('div', { class: 'date' }, fmtDateLong(new Date(next.targetAt).toISOString().slice(0, 10)))),
      future.length > 1 ? h('div', { class: 'cd-list', style: { marginTop: '8px' } },
        future.slice(1, 4).map(c => h('div', { class: 'cd-card soft-card', style: { padding: '12px' } },
          h('div', { class: 'n' }, (c.icon || '✈️') + ' ' + fmtCountdown(c.targetAt - Date.now())),
          h('div', { class: 'l' }, c.label)))) : '',
      h('div', { style: { marginTop: '12px', display: 'flex', justifyContent: 'center' } }, addBtn));
  }
  function addCountdown() {
    const label = h('input', { class: 'input', placeholder: 'until we see each other', maxlength: '120' });
    const when = h('input', { class: 'input', type: 'datetime-local' });
    const icons = ['✈️', '❤️', '🎂', '🌙', '📞', '🗺️'];
    let pick = '✈️';
    const iconRow = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, icons.map(i => h('button', { class: 'chip' + (i === '✈️' ? ' on' : ''), onclick: (e) => { pick = i; iconRow.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on'); } }, i)));
    modal({ title: 'Count down to something', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('What are you waiting for?', label), field('When?', when), field('A little icon', iconRow)),
      actions: [{ label: 'Add countdown', class: 'btn-primary', onclick: async (close) => {
        if (!when.value) { toast('Pick a date — even a hopeful one.'); return false; }
        try { await api('POST', '/api/countdowns', { label: label.value, targetAt: new Date(when.value).getTime(), icon: pick }); close(); renderCdPanel(); }
        catch (e) { toast(e.message); }
      } }] });
  }

  /* ---------- ws wiring ---------- */
  offs.push(on('ws:room:patch', ({ patch }) => { Object.assign(store.room, patch); applyRoom(); if (patch.music) updateMusicChip(); }));
  offs.push(on('ws:avatar:move', ({ userId, spot }) => {
    if (userId === meId) return;
    theirSpot = spot; renderAvatars();
  }));
  offs.push(on('presenceChanged', () => { renderAvatars(); }));
  offs.push(on('ws:interaction', ({ from }) => {
    if (from === meId) return;
    const them = svg.querySelector('#av-them');
    if (them) { them.classList.add('hugging'); setTimeout(() => them.classList.remove('hugging'), 1700); }
  }));
  offs.push(on('ws:float', ({ from, emoji }) => { if (from !== meId) floatEmoji(emoji); }));
  offs.push(on('mood', () => { renderMoodPanel(); }));
  offs.push(on('entity:countdowns', () => renderCdPanel()));
  offs.push(on('entity:memories', () => setFrames()));
  offs.push(on('audio', () => updateMusicChip()));

  function updateSoundIcon() {
    const b = document.getElementById('tb-sound');
    if (b) { b.innerHTML = icon(playing() ? 'volume' : 'volumex', 19); b.classList.toggle('on', !!playing()); }
  }

  /* ---------- init ---------- */
  applyThemeScene();
  (async () => {
    try {
      const d = await api('GET', '/api/presence');
      store.presence = { ...store.presence, ...d.presence };
      store.moods = { ...store.moods, ...d.moods };
      const meSpot = d.presence?.[meId]?.spot;
      if (meSpot && SPOTS[meSpot]) mySpot = meSpot;
      const p = partner();
      const theirPresSpot = p && d.presence?.[p.userId]?.spot;
      if (theirPresSpot && SPOTS[theirPresSpot]) theirSpot = theirPresSpot;
    } catch {}
    renderAvatars();
    renderSolo();
    renderMoodPanel();
    renderCdPanel();
    setFrames();
  })();

  function applyThemeScene() { applyRoom(); }

  return {
    destroy() { offs.forEach(off => off()); },
  };
}
