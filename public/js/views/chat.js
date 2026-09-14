// Private chat — intimate, quiet, elegant. Text, photos, voice, reactions, replies.
import { api, uploadMedia, mediaUrl, resolveMedia } from '../api.js';
import { applyMedia } from '../ui.js';
import { store, partner } from '../state.js';
import { on } from '../bus.js';
import { send } from '../ws.js';
import { h, icon, toast, modal, avatarEl, fmtTime, fmtDay, showMenu } from '../ui.js';

const QUICK_EMOJI = ['❤️', '😂', '🥹', '😮', '😔', '🔥', '🌙', '☕'];
const REACT_SET = ['❤️', '🥹', '😂', '😮', '🤗', '👍'];

export function render(root) {
  let messages = [];
  let replyTo = null;
  let typingTimer = null;
  const offs = [];
  const meId = store.me.user.id;
  const p = partner();

  const list = h('div', { class: 'chat-scroll', id: 'chat-scroll', role: 'log', 'aria-label': 'Messages' });
  const typing = h('div', { class: 'typing-note', id: 'typing-note', 'aria-live': 'polite' });

  const replyingBar = h('div', { class: 'replying', id: 'replying', style: { display: 'none' } });
  const input = h('textarea', { class: 'input', id: 'chat-input', placeholder: 'Write something small and true…', rows: '1', 'aria-label': 'Message' });
  const sendBtn = h('button', { class: 'btn btn-primary', style: { height: '46px', width: '46px', borderRadius: '999px', padding: 0, justifyContent: 'center' }, 'aria-label': 'Send', html: icon('send', 18), onclick: doSend });
  const imgBtn = h('button', { class: 'icon-btn', 'aria-label': 'Send a photo', html: icon('image', 19), onclick: sendPhoto });
  const micBtn = h('button', { class: 'icon-btn', 'aria-label': 'Record a voice note', html: icon('mic', 19), onclick: voiceNote });

  const composer = h('div', { class: 'composer' }, replyingBar,
    h('div', { class: 'emoji-row', 'aria-label': 'Quick reactions' }, QUICK_EMOJI.map(e => h('button', { 'aria-label': 'send ' + e, onclick: () => { input.value += e; input.focus(); } }, e))),
    h('div', { class: 'row' }, imgBtn, micBtn, input, sendBtn));

  const searchBtn = h('button', { class: 'icon-btn', 'aria-label': 'Search messages', html: icon('search', 19), onclick: openSearch });
  const head = h('div', { class: 'page-head', style: { marginBottom: '14px' } },
    h('div', { class: 't' }, h('span', { class: 'eyebrow' }, 'Just the two of you'), h('h1', { class: 'h1', style: { marginTop: '6px' } }, 'Chat')),
    h('div', { class: 'actions' }, p && store.presence[p.userId]?.online ? h('span', { class: 'chip', id: 'chat-presence' }, '● ' + (store.presence[p.userId].state === 'just_staying' ? 'just staying' : store.presence[p.userId].activity || store.presence[p.userId].state || 'online')) : '', searchBtn));

  root.append(h('div', { class: 'chat-page' }, head, list, typing, composer));

  /* ---------- rendering ---------- */
  function bubble(m) {
    const mine = m.sender === meId;
    const senderName = mine ? 'You' : (p?.displayName || 'Them');
    const b = h('div', { class: 'bubble' });
    if (m.replyTo) {
      const r = messages.find(x => x.id === m.replyTo);
      if (r) b.append(h('div', { class: 'reply-q' }, (r.sender === meId ? 'You: ' : (p?.displayName || 'They') + ': ') + (r.body || (r.type === 'image' ? 'photo' : 'voice note'))));
    }
    if (m.type === 'image' && m.media) {
      const im = h('img', { alt: 'photo from ' + senderName, loading: 'lazy' });
      applyMedia(im, m.media);
      im.onclick = () => resolveMedia(m.media).then((u) => { if (u) window.open(u, '_blank'); });
      b.append(im);
      if (m.body) b.append(h('div', { class: 'small' }, m.body));
    } else if (m.type === 'voice' && m.media) {
      b.append(h('audio', { controls: true, preload: 'metadata', src: mediaUrl(m.media) }));
    } else {
      b.append(h('span', { style: { whiteSpace: 'pre-wrap' } }, m.body || ''));
    }
    const meta = h('span', { class: 'time' }, fmtTime(m.createdAt));
    if (mine) {
      const seen = (m.reads || []).some(u => u !== meId);
      if (seen && messages[messages.length - 1]?.id === m.id) meta.append(' · ', h('span', { class: 'seen' }, 'seen'));
    }
    b.append(meta);

    const reacts = h('div', { class: 'reacts' });
    const drawReacts = () => {
      reacts.replaceChildren();
      const grouped = {};
      for (const r of (m.reactions || [])) grouped[r.emoji] = (grouped[r.emoji] || []).concat(r.userId);
      for (const [e, users] of Object.entries(grouped)) {
        reacts.append(h('button', { class: users.includes(meId) ? 'on-chip' : '', 'aria-label': 'reaction ' + e, onclick: () => api('POST', `/api/messages/${m.id}/react`, { emoji: e }).catch(() => {}) }, e + (users.length > 1 ? users.length : '')));
      }
    };
    drawReacts();

    const msg = h('div', { class: 'msg' + (mine ? ' mine' : ''), dataset: { id: m.id } },
      avatarEl(mine ? { name: store.me.user.name, avatar: store.me.user.avatar, ...store.me.user.member } : { name: p?.name, ...p }, 28),
      h('div', {}, b, reacts),
      h('div', { class: 'hover-tools' },
        h('button', { class: 'icon-btn', style: { width: '30px', height: '30px' }, 'aria-label': 'React', html: icon('heart', 14), onclick: (e) => reactMenu(m, e.currentTarget) }),
        h('button', { class: 'icon-btn', style: { width: '30px', height: '30px' }, 'aria-label': 'Reply', html: icon('reply', 14), onclick: () => setReply(m) }),
        h('button', { class: 'icon-btn', style: { width: '30px', height: '30px' }, 'aria-label': 'More', html: icon('dots', 14), onclick: (e) => moreMenu(m, e.currentTarget) })));
    return msg;
  }

  function renderList({ keepScroll = false } = {}) {
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    list.replaceChildren();
    if (!messages.length) {
      list.append(h('div', { class: 'empty', style: { marginTop: '30px' } },
        h('div', { class: 'big' }, p ? 'This is where it all starts.' : 'Soon, this fills up.'),
        h('div', { class: 'small muted' }, p ? 'Say hello — or say nothing and just stay.' : 'Invite your partner and the first hello is waiting.')));
      return;
    }
    let lastDay = '';
    for (const m of messages) {
      if (m.deleted) continue;
      const day = fmtDay(m.createdAt);
      if (day !== lastDay) { list.append(h('div', { class: 'day-sep' }, h('span', {}, day))); lastDay = day; }
      list.append(bubble(m));
    }
    if (!keepScroll || atBottom) requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    markRead();
  }

  async function load() {
    try {
      const d = await api('GET', '/api/messages');
      messages = d.messages;
      renderList();
    } catch (e) { toast(e.message); }
  }

  /* ---------- sending ---------- */
  function setReply(m) {
    replyTo = m;
    replyingBar.style.display = '';
    replyingBar.replaceChildren(h('span', { html: icon('reply', 14) }),
      h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, 'Replying to: ' + (m.body || (m.type === 'image' ? 'photo' : 'voice note'))),
      h('button', { class: 'x', 'aria-label': 'Cancel reply', onclick: () => { replyTo = null; replyingBar.style.display = 'none'; } }, h('span', { html: icon('x', 13) })));
    input.focus();
  }

  async function doSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; autoGrow();
    const rt = replyTo; replyTo = null; replyingBar.style.display = 'none';
    try {
      const d = await api('POST', '/api/messages', { type: 'text', body: text, replyTo: rt?.id || null });
      messages.push(d.message);
      renderList({ keepScroll: true });
    } catch (e) { toast(e.message); input.value = text; }
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  input.addEventListener('input', () => {
    autoGrow();
    if (!typingTimer) {
      send({ t: 'typing', on: true });
      typingTimer = setTimeout(() => { typingTimer = null; send({ t: 'typing', on: false }); }, 2500);
    }
  });
  function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 130) + 'px'; }

  async function sendPhoto() {
    const fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    document.body.append(fileInput);
    fileInput.onchange = async () => {
      const f = fileInput.files[0];
      fileInput.remove();
      if (!f) return;
      toast('Sending your photo…', { dur: 1600 });
      try {
        const media = await uploadMedia(f);
        const d = await api('POST', '/api/messages', { type: 'image', media: media.id, body: '' });
        messages.push(d.message); renderList({ keepScroll: true });
      } catch (e) { toast(e.message); }
    };
    fileInput.click();
  }

  function voiceNote() {
    if (!navigator.mediaDevices?.getUserMedia) { toast('Voice notes need microphone access — this window doesn\'t allow it.'); return; }
    let rec = null, chunks = [];
    micBtn.classList.add('on');
    micBtn.innerHTML = icon('micoff', 19);
    toast('Recording… tap the mic again to send.', { dur: 5000 });
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        micBtn.classList.remove('on'); micBtn.innerHTML = icon('mic', 19);
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 1200) { toast('That one was too short to keep.'); return; }
        try {
          const media = await uploadMedia(new File([blob], 'voice.webm', { type: blob.type }));
          const d = await api('POST', '/api/messages', { type: 'voice', media: media.id });
          messages.push(d.message); renderList({ keepScroll: true });
        } catch (e) { toast(e.message); }
      };
      rec.start();
      const stop = () => { if (rec && rec.state !== 'inactive') rec.stop(); micBtn.onclick = voiceNote; };
      micBtn.onclick = stop;
      setTimeout(() => { if (rec && rec.state === 'recording') stop(); }, 60000);
    }).catch(() => { micBtn.classList.remove('on'); micBtn.innerHTML = icon('mic', 19); toast('We couldn\'t reach your microphone — check permissions.'); });
  }

  /* ---------- actions ---------- */
  function reactMenu(m, anchor) {
    showMenu(REACT_SET.map(e => ({ label: e, onclick: () => api('POST', `/api/messages/${m.id}/react`, { emoji: e }).catch(() => {}) })), anchor);
  }
  function moreMenu(m, anchor) {
    const items = [
      { label: 'Reply', icon: 'reply', onclick: () => setReply(m) },
      { label: 'Save to Memories', icon: 'image', onclick: async () => {
        try {
          await api('POST', '/api/memories', { type: 'note', title: 'A message worth keeping', body: (m.body || '[' + m.type + ']'), happenedOn: new Date(m.createdAt).toISOString().slice(0, 10) });
          toast('Saved to your memories.');
        } catch (e) { toast(e.message); }
      } },
    ];
    if (m.sender === meId) items.push({ label: 'Delete', icon: 'trash', onclick: async () => {
      if (await confirmDelete()) { try { await api('DELETE', '/api/messages/' + m.id); } catch (e) { toast(e.message); } }
    } });
    showMenu(items, anchor);
  }
  async function confirmDelete() {
    return new Promise((res) => {
      modal({ title: 'Delete this message?', body: h('p', { class: 'muted' }, 'It disappears for both of you. Replies keep their place.'),
        actions: [{ label: 'Keep it', class: 'btn-ghost', onclick: () => res(false) }, { label: 'Delete', class: 'btn-danger', onclick: () => res(true) }],
        onClose: () => res(false) });
    });
  }

  async function markRead() {
    try { await api('POST', '/api/messages/read-all', {}); } catch {}
  }

  function openSearch() {
    const q = h('input', { class: 'input', placeholder: 'Search your words…' });
    const results = h('div', { style: { marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' } });
    let t = null;
    q.oninput = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        if (q.value.trim().length < 2) { results.replaceChildren(); return; }
        const d = await api('GET', '/api/messages/search?q=' + encodeURIComponent(q.value)).catch(() => null);
        results.replaceChildren(...(d?.messages || []).slice().reverse().map(m => h('button', { class: 'soft-card', style: { textAlign: 'left', cursor: 'pointer' }, onclick: () => { mo.close(); } },
          h('div', { class: 'tiny faint' }, (m.sender === meId ? 'You' : p?.displayName || 'Them') + ' · ' + fmtDay(m.createdAt)),
          h('div', { class: 'small', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.body.slice(0, 120)))));
        if (!(d?.messages || []).length) results.append(h('div', { class: 'small muted', style: { textAlign: 'center', padding: '14px' } }, 'Nothing found — try other words.'));
      }, 300);
    };
    const mo = modal({ title: 'Search', body: h('div', {}, q, results) });
    setTimeout(() => q.focus(), 50);
  }

  /* ---------- realtime ---------- */
  offs.push(on('chat', (m) => {
    if (!m || m.coupleId !== store.me.couple.id) return;
    const i = messages.findIndex(x => x.id === m.id);
    if (i >= 0) messages[i] = m; else messages.push(m);
    messages.sort((a, b) => a.createdAt - b.createdAt);
    renderList({ keepScroll: true });
  }));
  offs.push(on('chat:react', ({ messageId, reactions }) => {
    const m = messages.find(x => x.id === messageId);
    if (m) { m.reactions = reactions; renderList({ keepScroll: true }); }
  }));
  offs.push(on('chat:delete', ({ id }) => {
    const m = messages.find(x => x.id === id);
    if (m) { m.deleted = 1; m.body = ''; renderList({ keepScroll: true }); }
  }));
  offs.push(on('chat:read', ({ userId }) => {
    if (userId === meId) return;
    for (const m of messages) if (m.sender === meId) m.reads = [...(m.reads || []), userId];
    renderList({ keepScroll: true });
  }));
  offs.push(on('typing', ({ userId, on }) => {
    if (userId === meId) return;
    typing.replaceChildren(...(on ? [h('span', { class: 'd' }, ''), h('span', { class: 'd' }, ''), h('span', { class: 'd' }, ''), h('span', {}, (p?.displayName || 'They') + ' are typing…')] : []));
  }));
  offs.push(on('presenceChanged', () => {
    const el = document.getElementById('chat-presence');
    const pres = p && store.presence[p.userId];
    if (el && pres?.online) el.textContent = '● ' + (pres.state === 'just_staying' ? 'just staying' : pres.activity || pres.state || 'online');
  }));

  load();
  return { destroy() { offs.forEach(off => off()); } };
}
