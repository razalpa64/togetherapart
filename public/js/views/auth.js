// Sign in · create account · reset password · join with a code · enter demo world.
import { api, setToken, getToken } from '../api.js';
import { h, icon, toast, field } from '../ui.js';

export function render(_app, params, done) {
  let mode = params.get('mode') || 'login'; // login | join | reset
  const resetToken = params.get('token');
  const joinCode = params.get('code');
  const recoveryMode = params.get('recovery') === '1'; // supabase password-recovery session
  if (resetToken || recoveryMode) mode = 'reset';
  if (joinCode) mode = 'join';

  const errEl = h('div', { class: 'err', role: 'alert', style: { minHeight: '18px', fontSize: '0.85rem', color: 'var(--bad)' } });
  const formBox = h('div', {});
  const wrap = h('div', { class: 'auth-wrap' },
    h('div', { class: 'auth-side' },
      h('img', { src: '/img/hero-room.jpg', alt: 'A warm living room at dusk with two cups of tea on the table' }),
      h('div', { class: 'quote' },
        h('p', {}, '“Distance shouldn’t decide how two people spend time together.”'),
        h('span', {}, '— the whole idea behind this place'))),
    h('div', { class: 'auth-main' },
      h('a', { class: 'wordmark', href: '/' }, 'Together, ', h('em', {}, 'Apart')),
      formBox,
      h('div', { class: 'auth-alt' },
        mode !== 'demo' ? h('div', { class: 'auth-demo' },
          h('span', {}, h('b', {}, 'No partner handy right now?'), ' Explore the ', h('b', {}, 'demo world'), ' — full sample data, clearly labeled.'),
          h('button', { class: 'btn btn-subtle btn-sm', onclick: async () => {
            try { const d = await api('POST', '/api/demo/login', { side: 'aisha' }); setToken(d.token); done(); }
            catch (e) { toast(e.message); }
          } }, 'Enter demo world')) : null)));

  function swapMode(m) { mode = m; draw(); }
  // Google OAuth — only offered when a Supabase backend is active and configured.
  function googleBtn() {
    if (!(window.__TA_CAPS__ || {}).google) return null;
    const g = h('span', { style: { width: '16px', height: '16px', display: 'inline-flex' }, html: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.2 17.2C3.1 21.2 7.2 24 12 24z"/><path fill="#FBBC05" d="M5.1 14.3c-.3-.8-.4-1.6-.4-2.3s.2-1.6.4-2.3L1.2 6.8C.4 8.4 0 10.1 0 12s.4 3.6 1.2 5.2l3.9-2.9z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17 .9 15.2 0 12 0 7.2 0 3.1 2.8 1.2 6.8l3.9 2.9c.9-3 3.7-5 6.9-5z"/></svg>' });
    return h('div', { style: { marginTop: '10px' } },
      h('button', { type: 'button', class: 'btn btn-subtle btn-lg', style: { width: '100%' }, onclick: async () => {
        try { await api('POST', '/api/auth/google', {}); } catch (e) { errEl.textContent = e.message; }
      } }, g, 'Continue with Google'));
  }

  function draw() {
    errEl.textContent = '';
    formBox.replaceChildren();
    if (mode === 'reset') return drawReset();
    if (mode === 'join') return drawJoin();
    if (mode === 'signup') return drawSignup();
    drawLogin();
  }

  function head(eyebrow, title, sub) {
    formBox.append(h('div', {},
      h('span', { class: 'eyebrow' }, eyebrow),
      h('h1', { class: 'display-2' }, title),
      h('p', { class: 'sub' }, sub)));
  }
  const switchRow = () => h('div', { class: 'auth-row' },
    h('span', { class: 'muted small' }, mode === 'signup' ? 'Already have a world?' : 'New here?'),
    h('button', { class: 'btn btn-ghost btn-sm', onclick: () => swapMode(mode === 'signup' ? 'login' : 'signup') }, mode === 'signup' ? 'Sign in' : 'Create your world'));

  function drawLogin() {
    head('Welcome back', 'Welcome home.', 'The lamps are on. The kettle\'s warm.');
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', placeholder: 'you@somewhere.com' });
    const password = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Your password' });
    const submit = h('button', { class: 'btn btn-primary btn-lg', style: { marginTop: '6px' } }, 'Sign in');
    submit.onclick = async () => {
      submit.disabled = true;
      try { const d = await api('POST', '/api/auth/login', { email: email.value, password: password.value }); setToken(d.token); done(); }
      catch (e) { errEl.textContent = e.message; submit.disabled = false; }
    };
    formBox.append(h('form', { class: 'auth-form', onsubmit: (e) => { e.preventDefault(); submit.click(); } },
      field('Email', email), field('Password', password),
      h('div', { class: 'auth-row' }, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => swapMode('reset') }, 'Forgot password?'), ''),
      errEl, submit, googleBtn(), switchRow()));
  }

  function drawSignup() {
    head(joinCode ? 'Join your partner' : 'Create your world', joinCode ? 'Almost there.' : 'Let\'s make your place.', joinCode ? 'Make an account, and the code takes care of the rest.' : 'One account for you. Your partner makes their own.');
    const name = h('input', { class: 'input', autocomplete: 'name', placeholder: 'Your name', value: '' });
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', placeholder: 'you@somewhere.com' });
    const password = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'At least 8 characters' });
    const submit = h('button', { class: 'btn btn-primary btn-lg', style: { marginTop: '6px' } }, joinCode ? 'Join ' + joinCode : 'Create account');
    submit.onclick = async () => {
      submit.disabled = true;
      try {
        const d = await api('POST', '/api/auth/signup', { name: name.value, email: email.value, password: password.value });
        setToken(d.token);
        if (joinCode) {
          try { await api('POST', '/api/couple/join', { code: joinCode }); }
          catch (e) { toast(e.message); }
        }
        done();
      } catch (e) { errEl.textContent = e.message; submit.disabled = false; }
    };
    formBox.append(h('form', { class: 'auth-form', onsubmit: (e) => { e.preventDefault(); submit.click(); } },
      field('Your name', name), field('Email', email), field('Password', password, 'Eight characters or more.'),
      errEl, submit, googleBtn(), switchRow()));
  }

  function drawJoin() {
    head('Join your partner', 'You\'ve been invited somewhere.', 'Enter the code they shared — it looks like LUNA-4827.');
    const code = h('input', { class: 'input', style: { textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-serif)', fontSize: '1.3rem', textAlign: 'center' }, placeholder: 'LUNA-4827', maxlength: '12' });
    const submit = h('button', { class: 'btn btn-primary btn-lg' }, 'Find their world');
    submit.onclick = async () => {
      submit.disabled = true;
      try { await api('POST', '/api/couple/join', { code: code.value }); done(); }
      catch (e) { errEl.textContent = e.message; submit.disabled = false; }
    };
    formBox.append(h('form', { class: 'auth-form', onsubmit: (e) => { e.preventDefault(); submit.click(); } },
      field('Invitation code', code), errEl, submit,
      h('div', { class: 'auth-row' }, h('span', { class: 'muted small' }, 'Don\'t have an account yet?'), h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => swapMode('signup') }, 'Create one'))));
    if (joinCode) code.value = joinCode;
  }

  function drawReset() {
    head('Password reset', 'Let\'s get you back in.', (resetToken || recoveryMode) ? 'Choose a new password for your account.' : 'We\'ll send a reset link to your email.');
    if (resetToken || recoveryMode) {
      const p1 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'New password (8+ characters)' });
      const submit = h('button', { class: 'btn btn-primary btn-lg' }, 'Save new password');
      submit.onclick = async () => {
        try {
          await api('POST', '/api/auth/reset', { token: resetToken || 'recovery', password: p1.value });
          toast('Password saved.');
          if (recoveryMode && getToken()) done(); else swapMode('login');
        }
        catch (e) { errEl.textContent = e.message; }
      };
      formBox.append(h('form', { class: 'auth-form', onsubmit: (e) => { e.preventDefault(); submit.click(); } }, field('New password', p1), errEl, submit));
      return;
    }
    const email = h('input', { class: 'input', type: 'email', placeholder: 'you@somewhere.com' });
    const submit = h('button', { class: 'btn btn-primary btn-lg' }, 'Send reset link');
    submit.onclick = async () => {
      try {
        const d = await api('POST', '/api/auth/reset-request', { email: email.value });
        if (d.resetUrl) {
          formBox.replaceChildren();
          head('Check your inbox', 'On its way.', 'If that email exists, a reset link is on its way.');
          formBox.append(h('div', { class: 'soft-card', style: { marginTop: '18px' } },
            h('p', { class: 'small muted' }, d.message),
            h('a', { class: 'btn btn-rose btn-sm', href: d.resetUrl, style: { marginTop: '10px' } }, 'Open reset link')),
            h('button', { class: 'btn btn-ghost btn-sm', style: { marginTop: '16px' }, onclick: () => swapMode('login') }, 'Back to sign in'));
        } else { toast('If that email exists, a reset link is on its way.'); }
      } catch (e) { errEl.textContent = e.message; }
    };
    formBox.append(h('form', { class: 'auth-form', onsubmit: (e) => { e.preventDefault(); submit.click(); } },
      field('Email', email), errEl, submit,
      h('div', { class: 'auth-row' }, h('span', { class: 'muted small' }, 'Remembered it?'), h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => swapMode('login') }, 'Sign in'))));
  }

  draw();
  return wrap;
}
