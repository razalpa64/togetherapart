// Couple onboarding — three gentle questions, then the invitation.
import { api } from '../api.js';
import { h, icon, toast, copyText } from '../ui.js';
import { store } from '../state.js';
import { on } from '../bus.js';

export function render(done) {
  let step = 1;
  let yourName = store.me?.user?.name || '';
  let partnerName = '';
  let couple = null;
  let poller = null;
  let offJoined = null;

  const card = h('div', { class: 'onb-card' });
  const wrap = h('div', { class: 'onb grain' }, card);

  function dots() {
    return h('div', { class: 'step-dots', 'aria-hidden': 'true' }, ...[1, 2, 3].map(i => h('span', { class: i === step ? 'on' : '' })));
  }

  function draw() {
    card.replaceChildren();
    if (step === 1) {
      const input = h('input', { class: 'input onb-input', placeholder: 'Your name', value: yourName, maxlength: '40', 'aria-label': 'Your name' });
      const next = h('button', { class: 'btn btn-primary btn-lg' }, 'Continue');
      next.onclick = () => { if (!input.value.trim()) { toast('Even a nickname works.'); return; } yourName = input.value.trim(); step = 2; draw(); };
      card.append(dots(),
        h('h1', { class: 'display-2' }, 'What\'s your name?'),
        h('p', { class: 'sub' }, 'Just what we should call you in your world.'),
        h('form', { onsubmit: (e) => { e.preventDefault(); next.click(); }, style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, input, next),
        h('button', { class: 'btn btn-ghost btn-sm', style: { marginTop: '22px' }, onclick: drawJoin }, 'I have an invitation code'));
      setTimeout(() => input.focus(), 80);
    }

    else if (step === 2) {
      const input = h('input', { class: 'input onb-input', placeholder: 'Their name', value: partnerName, maxlength: '40', 'aria-label': 'Partner name' });
      const next = h('button', { class: 'btn btn-primary btn-lg' }, 'Create your world');
      next.onclick = async () => {
        if (!input.value.trim()) { toast('What do they go by?'); return; }
        partnerName = input.value.trim();
        next.disabled = true;
        try { const d = await api('POST', '/api/couple', { yourName, partnerName }); couple = d.couple; step = 3; draw(); }
        catch (e) { toast(e.message); next.disabled = false; }
      };
      card.append(dots(),
        h('h1', { class: 'display-2' }, 'What should we call your partner?'),
        h('p', { class: 'sub' }, 'The person this whole world is for.'),
        h('form', { onsubmit: (e) => { e.preventDefault(); next.click(); }, style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, input, next));
      setTimeout(() => input.focus(), 80);
    }

    else if (step === 3) {
      const link = location.origin + '/app#/auth?mode=join&code=' + couple.inviteCode;
      card.append(dots(),
        h('h1', { class: 'display-2' }, 'Your world is ready.'),
        h('p', { class: 'sub' }, 'Share this with ', h('b', {}, partnerName), ' — they\'ll enter it when they sign up. Then it\'s the two of you.'),
        h('div', { class: 'invite-box' },
          h('div', { class: 'tag', style: { justifyContent: 'center', display: 'flex' } }, 'invitation code'),
          h('div', { class: 'invite-code' }, couple.inviteCode),
          h('div', { class: 'invite-row' },
            h('button', { class: 'btn btn-primary btn-sm', onclick: () => copyText(couple.inviteCode, 'Code copied — send it their way') }, h('span', { html: icon('copy', 15) }), 'Copy code'),
            h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { if (navigator.share) { try { await navigator.share({ title: 'Together, Apart', text: 'Come join our little world 💛', url: link }); } catch {} } else copyText(link, 'Invite link copied'); } }, h('span', { html: icon('share', 15) }), 'Share invitation'))),
        h('div', { style: { marginTop: '30px' } },
          h('div', { class: 'waiting-pulse' }, h('span', { class: 'p' }), h('span', { class: 'p' }), h('span', { class: 'p' })),
          h('p', { class: 'muted small', id: 'wait-note' }, 'Waiting for ' + partnerName + '… you can go inside and wait on the sofa.'),
          h('button', { class: 'btn btn-ghost btn-lg', style: { marginTop: '16px' }, onclick: () => { stopPoll(); done(); } }, 'Go inside anyway')));
      startPoll();
    }
  }

  function drawJoin() {
    card.replaceChildren();
    const code = h('input', { class: 'input onb-input', placeholder: 'LUNA-4827', maxlength: '12', 'aria-label': 'Invitation code', style: { textTransform: 'uppercase', letterSpacing: '0.12em' } });
    const go = h('button', { class: 'btn btn-primary btn-lg' }, 'Join their world');
    go.onclick = async () => {
      try { await api('POST', '/api/couple/join', { code: code.value }); done(); }
      catch (e) { toast(e.message); }
    };
    card.append(dots(),
      h('h1', { class: 'display-2' }, 'Enter your invitation code.'),
      h('p', { class: 'sub' }, 'The one your partner shared with you.'),
      h('form', { onsubmit: (e) => { e.preventDefault(); go.click(); }, style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, code, go));
    setTimeout(() => code.focus(), 80);
  }

  function startPoll() {
    stopPoll();
    poller = setInterval(async () => {
      try {
        const d = await api('GET', '/api/me');
        if (d.couple && d.couple.members >= 2) joined(d);
      } catch {}
    }, 3000);
    offJoined = on('ws:couple:joined', () => joined(null));
  }
  function stopPoll() { clearInterval(poller); poller = null; if (offJoined) { offJoined(); offJoined = null; } }

  let flashed = false;
  async function joined() {
    if (flashed) return;
    flashed = true;
    stopPoll();
    card.replaceChildren();
    card.classList.add('joined-flash');
    card.append(
      h('div', { style: { fontSize: '3rem', marginBottom: '8px' } }, '🕯️'),
      h('h1', { class: 'display' }, 'You\'re together now.'),
      h('p', { class: 'sub' }, 'The lamps are on. Go make it yours.'),
      h('button', { class: 'btn btn-primary btn-lg', style: { marginTop: '26px' }, onclick: () => done() }, 'Open your place'));
    setTimeout(() => { if (document.contains(wrap)) done(); }, 6000);
  }

  draw();
  return wrap;
}
