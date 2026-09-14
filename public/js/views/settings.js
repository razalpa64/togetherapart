// SETTINGS — profile, couple, notifications, sound, privacy, account.
import { api, uploadMedia, clearToken } from '../api.js';
import { store, refreshMe, applyTheme, partner, coupleIsDemo } from '../state.js';
import { on } from '../bus.js';
import { h, icon, toast, modal, field, avatarEl, avatarSvg, ACCENTS, copyText } from '../ui.js';
import { getVolume, setVolume, play, AMBIENCES } from '../audio.js';

export function render(root) {
  const offs = [];
  const me = store.me;
  const member = me.user.member || {};
  const p = partner();

  const profileCard = h('div', { class: 'card card-pad' });
  const coupleCard = h('div', { class: 'card card-pad' });
  const notifCard = h('div', { class: 'card card-pad' });
  const soundCard = h('div', { class: 'card card-pad' });
  const privacyCard = h('div', { class: 'card card-pad' });
  const accountCard = h('div', { class: 'card card-pad' });

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' }, h('span', { class: 'eyebrow' }, 'The details'), h('h1', { class: 'display-2' }, 'Settings'))),
    h('div', { class: 'set-grid' },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, profileCard, coupleCard, privacyCard),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, notifCard, soundCard, accountCard))));

  /* ---------- profile ---------- */
  function drawProfile() {
    const name = h('input', { class: 'input', value: me.user.name, maxlength: '40' });
    const displayName = h('input', { class: 'input', value: member.displayName || '', placeholder: 'What they call you', maxlength: '40' });
    const tz = h('input', { class: 'input', value: me.user.tz || Intl.DateTimeFormat().resolvedOptions().timeZone, readonly: true });
    const accents = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      Object.entries(ACCENTS).map(([id, a]) => h('button', {
        class: 'chip' + ((member.accent || 'rose') === id ? ' on' : ''),
        onclick: async (e) => { await api('POST', '/api/profile', { accent: id }); me.user.member.accent = id; e.currentTarget.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on'); drawAvatarPreview(); },
      }, h('span', { style: { width: '12px', height: '12px', borderRadius: '50%', background: a.main, display: 'inline-block' } }), id)));
    const hairs = h('div', { class: 'seg' }, ['short', 'medium', 'long', 'curl', 'bun'].map(hr => h('button', {
      class: (member.hair || 'short') === hr ? 'on' : '',
      onclick: async (e) => { await api('POST', '/api/profile', { hair: hr }); me.user.member.hair = hr; hairs.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); drawAvatarPreview(); },
    }, hr)));
    const avatarPreview = h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } });
    function drawAvatarPreview() {
      avatarPreview.replaceChildren(avatarEl({ name: me.user.name, avatar: me.user.avatar, accent: member.accent, hair: member.hair }, 56),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
          const fi = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
          document.body.append(fi);
          fi.onchange = async () => { const f = fi.files[0]; fi.remove(); if (!f) return;
            try { const md = await uploadMedia(f); await api('POST', '/api/profile', { avatar: md.id }); me.user.avatar = md.id; await refreshMe(); drawAvatarPreview(); toast('Looking like you.'); } catch (e) { toast(e.message); } };
          fi.click();
        } }, h('span', { html: icon('image', 14) }), 'Photo'),
        me.user.avatar ? h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await api('POST', '/api/profile', { avatar: null }); me.user.avatar = null; await refreshMe(); drawAvatarPreview(); } }, 'Use illustration') : '');
    }
    drawAvatarPreview();
    profileCard.replaceChildren(
      h('h2', { class: 'h2', style: { marginBottom: '4px' } }, 'You'),
      avatarPreview, h('div', { class: 'hr' }),
      field('Your name', name), field('In your world (display name)', displayName),
      field('Look', h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, accents, hairs)),
      field('Timezone', tz, 'It helps show your partner when your "goodnight" actually is.'),
      h('button', { class: 'btn btn-primary', style: { marginTop: '6px' }, onclick: async () => {
        await api('POST', '/api/profile', { name: name.value, displayName: displayName.value, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
        await refreshMe(); toast('Saved.');
      } }, 'Save profile'));
  }

  /* ---------- couple ---------- */
  function drawCouple() {
    const name = h('input', { class: 'input', value: me.couple.name, maxlength: '60' });
    const anniv = h('input', { class: 'input', type: 'date', value: me.couple.anniversary || '' });
    coupleCard.replaceChildren(
      h('h2', { class: 'h2', style: { marginBottom: '4px' } }, 'Your world'),
      h('div', { class: 'set-row' },
        h('div', { class: 'l' }, h('div', { class: 't' }, 'Light'), h('div', { class: 'd' }, 'Evening warmth or morning light')),
        h('div', { class: 'seg' }, ['evening', 'morning'].map(t => h('button', { class: me.couple.theme === t ? 'on' : '', onclick: async () => { await api('PATCH', '/api/couple', { theme: t }); me.couple.theme = t; applyTheme(); drawCouple(); } }, t === 'evening' ? '🕯 Evening' : '🌤 Morning')))),
      field('World name', name), field('Anniversary', anniv),
      h('div', { class: 'set-row' },
        h('div', { class: 'l' }, h('div', { class: 't' }, 'Plan'), h('div', { class: 'd' }, me.couple.plan === 'premium' ? 'Premium — everything unlocked' : 'Free — warm and complete')),
        h('a', { class: 'btn btn-ghost btn-sm', href: '#/premium' }, 'Details')),
      p ? h('p', { class: 'small muted', style: { marginTop: '10px' } }, 'Living here: you and ', h('b', {}, p.displayName || p.name), '.') :
        h('div', { class: 'soft-card', style: { marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' } },
          h('span', { class: 'small' }, 'The second chair is still empty.'),
          h('button', { class: 'btn btn-primary btn-sm', onclick: () => copyText(me.couple.inviteCode, 'Code copied') }, 'Copy invite code')),
      h('button', { class: 'btn btn-primary', style: { marginTop: '14px' }, onclick: async () => {
        await api('PATCH', '/api/couple', { name: name.value, anniversary: anniv.value || null });
        await refreshMe(); toast('Saved.');
      } }, 'Save world'));
  }

  /* ---------- notifications ---------- */
  async function drawNotifs() {
    const d = await api('GET', '/api/notifications').catch(() => null);
    const prefs = d?.prefs || {};
    const cats = [
      ['messages', 'Messages', 'When you\'re away and they write'],
      ['surprises', 'Surprises', 'The moment one unlocks'],
      ['dates', 'Dates', 'When a date starts or is planned'],
      ['memories', 'Memories & more', 'New memories, songs, places, milestones'],
      ['moods', 'Moods', 'Only when it matters — like “need you”'],
      ['presence', 'Arrivals', 'When they walk in'],
    ];
    notifCard.replaceChildren(h('h2', { class: 'h2', style: { marginBottom: '4px' } }, 'Notifications'),
      h('p', { class: 'small muted', style: { marginBottom: '8px' } }, 'Gentle by default. You\'ll never get noise from us.'),
      ...cats.map(([id, label, desc]) => h('div', { class: 'pref-row' },
        h('div', { class: 'l' }, label, h('span', { class: 'd' }, desc)),
        h('button', { class: 'switch', role: 'switch', 'aria-checked': String(prefs[id] !== false), 'aria-label': label + ' notifications', onclick: async (e) => {
          const next = e.currentTarget.getAttribute('aria-checked') !== 'true';
          e.currentTarget.setAttribute('aria-checked', String(next));
          await api('PUT', '/api/notifications/prefs', { [id]: next });
        } }))));
  }

  /* ---------- sound ---------- */
  function drawSound() {
    const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(getVolume()), 'aria-label': 'Master volume', style: { width: '100%', accentColor: 'var(--burgundy)' } });
    vol.oninput = () => setVolume(parseFloat(vol.value));
    soundCard.replaceChildren(h('h2', { class: 'h2', style: { marginBottom: '4px' } }, 'Sound'),
      h('p', { class: 'small muted', style: { marginBottom: '10px' } }, 'Ambience volume — rain, fire, ocean, café, night, wind.'),
      vol,
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' } },
        AMBIENCES.map(a => h('button', { class: 'chip', onclick: () => play(a.id) }, a.emoji + ' ' + a.label)),
        h('button', { class: 'chip', onclick: () => { import('../audio.js').then(m => m.stop()); } }, '⏹ Stop')));
  }

  /* ---------- privacy ---------- */
  privacyCard.replaceChildren(h('h2', { class: 'h2', style: { marginBottom: '4px' } }, 'Privacy'),
    h('p', { class: 'small muted', style: { lineHeight: 1.6 } },
      'Your world is visible to exactly two people: you and your partner. ',
      'Nothing here is searchable, public, or shared. Photos and voice notes are served only to the two of you, ',
      'behind your sign-in. No analytics, no third parties, no “improving your experience.”'),
    h('div', { class: 'soft-card', style: { marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' } },
      h('span', { html: icon('lock', 18), style: { color: 'var(--sage)' } }),
      h('span', { class: 'small' }, 'Sealed surprises stay sealed — even the server won\'t hand them over early.')));

  /* ---------- account ---------- */
  accountCard.replaceChildren(h('h2', { class: 'h2', style: { marginBottom: '4px' } }, 'Account'),
    h('div', { class: 'set-row' },
      h('div', { class: 'l' }, h('div', { class: 't' }, me.user.email), h('div', { class: 'd' }, coupleIsDemo() ? 'demo account — not a real login' : 'your sign-in email'))),
    h('button', { class: 'btn btn-ghost', style: { marginTop: '10px' }, onclick: async () => {
      await api('POST', '/api/auth/logout').catch(() => {});
      clearToken();
      location.hash = ''; location.reload();
    } }, h('span', { html: icon('logout', 15) }), 'Sign out'),
    !coupleIsDemo() ? h('div', { style: { marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--line)' } },
      h('div', { class: 'tag', style: { color: 'var(--bad)', marginBottom: '8px' } }, 'danger zone'),
      h('button', { class: 'btn btn-danger btn-sm', onclick: async () => {
        const sure = await new Promise(res => modal({ title: 'Leave this world forever?', body: h('p', { class: 'muted' }, 'Messages, memories, surprises — everything the two of you made here — will be deleted. There is no undo.'),
          actions: [{ label: 'Stay', class: 'btn-ghost', onclick: () => res(false) }, { label: 'Delete everything', class: 'btn-danger', closes: false, onclick: (close) => {
            modal({ title: 'Type “goodbye” to confirm', body: h('input', { class: 'input', id: 'dissolve-input', placeholder: 'goodbye' }), actions: [{ label: 'Cancel', class: 'btn-ghost', onclick: () => res(false) }, { label: 'Delete our world', class: 'btn-danger', closes: false, onclick: async (close2) => {
              const v = document.getElementById('dissolve-input').value.trim();
              if (v !== 'goodbye') return false;
              try { await api('POST', '/api/couple/dissolve', { confirm: v }); clearToken(); location.hash = ''; location.reload(); }
              catch (e) { toast(e.message); }
            } }] });
          } }] }));
        void sure;
      } }, 'Dissolve this world')) : '');

  drawProfile();
  drawCouple();
  drawNotifs();
  drawSound();
  return { destroy() { offs.forEach(off => off()); } };
}
