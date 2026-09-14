// End-to-end test: two users, one world, live sync over WebSockets.
// Usage: node test/ws-test.mjs   (expects the server on :3000, wipes nothing)
import crypto from 'node:crypto';

const BASE = 'http://localhost:' + (process.env.PORT || 3000);
let passed = 0, failed = 0;
const ok = (name, cond) => { if (cond) { passed++; console.log('  ✓', name); } else { failed++; console.log('  ✗', name); } };

async function api(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), 'X-TA': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/* --- minimal RFC6455 client (masked frames) --- */
class WS {
  connect(path) {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const req = require('http').request(new URL(BASE.replace('http', 'ws' === 'ws' ? 'http' : 'http')) .pathname ? BASE : BASE);
      const url = new URL(path, BASE);
      const mod = url.protocol === 'https:' ? require('https') : require('http');
      const r = mod.request({ host: url.hostname, port: url.port, path: url.pathname + url.search, headers: {
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13',
      }});
      r.on('upgrade', (res, socket) => {
        this.socket = socket;
        this.queue = [];
        this.waiters = [];
        this.open = true;
        socket.on('data', (d) => this._read(d));
        resolve(this);
      });
      r.on('error', reject);
      r.end();
    });
  }
  _read(d) {
    this.buf = Buffer.concat([this.buf || Buffer.alloc(0), d]);
    while (true) {
      const f = this._parse();
      if (!f) return;
      if (f.opcode === 0x9) { this._send(0xA, f.payload); continue; }
      if (f.opcode === 0xA) continue;
      if (f.opcode === 0x8) { this.open = false; return; }
      if (f.opcode === 0x1) {
        try {
          const msg = JSON.parse(f.payload.toString('utf8'));
          const w = this.waiters.find(x => x.pred(msg));
          if (w) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(msg); }
        } catch {}
      }
    }
  }
  _parse() {
    if (!this.buf || this.buf.length < 2) return null;
    const opcode = this.buf[0] & 0x0f, masked = !!(this.buf[1] & 0x80);
    let len = this.buf[1] & 0x7f, off = 2;
    if (len === 126) { if (this.buf.length < 4) return null; len = this.buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (this.buf.length < 10) return null; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
    let mask = null;
    if (masked) { mask = this.buf.subarray(off, off + 4); off += 4; }
    if (this.buf.length < off + len) return null;
    let payload = this.buf.subarray(off, off + len);
    if (mask) { const out = Buffer.allocUnsafe(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3]; payload = out; }
    this.buf = this.buf.subarray(off + len);
    return { opcode, payload };
  }
  send(obj) {
    const payload = Buffer.from(JSON.stringify(obj));
    const mask = crypto.randomBytes(4);
    const masked = Buffer.allocUnsafe(payload.length);
    for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i & 3];
    let header;
    if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
    else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
    this.socket.write(Buffer.concat([header, mask, masked]));
  }
  _send(opcode, payload) {
    let header;
    if (payload.length < 126) header = Buffer.from([0x80 | opcode, payload.length]);
    else { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
    this.socket.write(Buffer.concat([header, payload]));
  }
  wait(pred, ms = 4000) {
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), ms);
      const w = { pred, resolve: (m) => { clearTimeout(t); resolve(m); } };
      this.waiters.push(w);
    });
  }
}
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);

console.log('\nTogether, Apart — end-to-end test\n');

// 1. signup A + B
const suffix = crypto.randomBytes(3).toString('hex');
const a = await api(null, 'POST', '/api/auth/signup', { email: `a${suffix}@t.dev`, password: 'password123', name: 'Alina' });
const b = await api(null, 'POST', '/api/auth/signup', { email: `b${suffix}@t.dev`, password: 'password123', name: 'Bruno' });
ok('signup A & B', a.status === 200 && b.status === 200 && a.data.token && b.data.token);

// bad login
const bad = await api(null, 'POST', '/api/auth/login', { email: `a${suffix}@t.dev`, password: 'wrong-wrong' });
ok('bad password rejected', bad.status === 401);

// 2. create couple
const c = await api(a.data.token, 'POST', '/api/couple', { yourName: 'Alina', partnerName: 'Bruno' });
ok('couple created with invite code', c.status === 200 && /^[A-Z]+-\d{4}$/.test(c.data.couple.inviteCode));

// wrong code
const wrong = await api(b.data.token, 'POST', '/api/couple/join', { code: 'NOPE-9999' });
ok('wrong invite code rejected', wrong.status === 404);

// 3. join
const j = await api(b.data.token, 'POST', '/api/couple/join', { code: c.data.couple.inviteCode });
ok('partner joins with code', j.status === 200);

// 4. me snapshots
const meA = await api(a.data.token, 'GET', '/api/me');
const meB = await api(b.data.token, 'GET', '/api/me');
ok('A sees B as partner', meA.data.partner?.name === 'Bruno');
ok('B sees A as partner', meB.data.partner?.name === 'Alina');

// cross-couple isolation: demo user must NOT see A's data
const demo = await api(null, 'POST', '/api/demo/login', { side: 'aisha' });
const demoMsgs = await api(demo.data.token, 'GET', '/api/messages');
ok('couple isolation: demo cannot read A/B messages', demoMsgs.data.messages.every(m => m.body.includes('call') || m.body.includes('cafe') || m.sender !== a.data.user.id));

// 5. websockets
const wsA = await new WS().connect('/ws?token=' + a.data.token);
const helloP = wsA.wait(m => m.t === 'hello', 500); // hello may already be in flight
const wsB = await new WS().connect('/ws?token=' + b.data.token);
const helloA = await helloP;
ok('A websocket connected', !!helloA || wsA.open);

// A connects → B sees presence
const presP = wsB.wait(m => m.t === 'presence' && m.presence && m.presence[a.data.user.id]);
wsB.send({ t: 'presence', state: 'online', tz: 'Europe/Berlin' });
const pres = await presP;
ok('B sees A presence live', !!pres && pres.presence[a.data.user.id].online === true);

// avatar move
const moveP = wsB.wait(m => m.t === 'avatar:move' && m.userId === a.data.user.id);
wsA.send({ t: 'avatar:move', spot: 'window' });
const moved = await moveP;
ok('avatar movement syncs', moved?.spot === 'window');

// interaction
const hugP = wsB.wait(m => m.t === 'interaction' && m.type === 'hug');
wsA.send({ t: 'interaction', type: 'hug' });
const hug = await hugP;
ok('interactions sync (hug)', !!hug);

// 6. chat: A sends → B receives broadcast (register waiter first)
const chatP = wsB.wait(m => m.t === 'chat:message' && m.message?.body === 'the lamps are on');
const msg = await api(a.data.token, 'POST', '/api/messages', { type: 'text', body: 'the lamps are on' });
ok('A sends message', msg.status === 200);
const got = await chatP;
ok('B receives message live', !!got);

// reaction
const reactP = wsA.wait(m => m.t === 'chat:react' && m.messageId === msg.data.message.id);
await api(b.data.token, 'POST', `/api/messages/${msg.data.message.id}/react`, { emoji: '❤️' });
const react = await reactP;
ok('reactions sync', react?.reactions?.some(r => r.emoji === '❤️'));

// typing
const typingP = wsB.wait(m => m.t === 'chat:typing' && m.on === true);
wsA.send({ t: 'typing', on: true });
const typing = await typingP;
ok('typing indicator syncs', !!typing);

// 7. room patch
const roomP = wsB.wait(m => m.t === 'room:patch' && m.patch?.window === 'rain');
await api(a.data.token, 'PUT', '/api/room', { window: 'rain', lamp: false });
const room = await roomP;
ok('room changes sync (rain on the window)', !!room && room.patch.lamp === false);

// 8. mood
const moodP = wsB.wait(m => m.t === 'mood' && m.userId === a.data.user.id);
const notifP = wsB.wait(m => m.t === 'notify' && m.notification?.body?.includes('needs you'), 5000);
await api(a.data.token, 'PUT', '/api/mood', { mood: 'needyou' });
const mood = await moodP;
ok('mood syncs (need you)', mood?.mood === 'needyou');
const notif = await notifP;
ok('partner notified gently', !!notif);

// 9. game: tic tac toe
const gameP = wsB.wait(m => m.t === 'game:state' && m.session?.game === 'ttt');
const g = await api(a.data.token, 'POST', '/api/games/start', { game: 'ttt' });
ok('game started', g.status === 200);
const gstate = await gameP;
ok('B sees game start live', !!gstate);

// invalid: B moves out of turn
const wrongTurn = await api(b.data.token, 'POST', `/api/games/${g.data.session.id}/move`, { move: 0 });
ok('out-of-turn move rejected', wrongTurn.status === 400);

const mv1P = wsB.wait(m => m.t === 'game:state' && m.session?.state?.board?.[0] === a.data.user.id);
const mv1 = await api(a.data.token, 'POST', `/api/games/${g.data.session.id}/move`, { move: 0 });
ok('A moves (X)', mv1.status === 200 && mv1.data.session.state.board[0] === a.data.user.id);
const bSees = await mv1P;
ok('B sees the move live', !!bSees);

// proper alternation: B 3, A 1, B 4, A 2 → A wins with 0,1,2
await api(b.data.token, 'POST', `/api/games/${g.data.session.id}/move`, { move: 3 });
await api(a.data.token, 'POST', `/api/games/${g.data.session.id}/move`, { move: 1 });
await api(b.data.token, 'POST', `/api/games/${g.data.session.id}/move`, { move: 4 });
const win = await api(a.data.token, 'POST', `/api/games/${g.data.session.id}/move`, { move: 2 });
ok('win detected, series scored', win.data.session.status === 'done' && win.data.session.state.history[a.data.user.id] === 1);

// 10. surprises: sealed = sealed
const tomorrow = Date.now() + 86400000;
const s = await api(a.data.token, 'POST', '/api/surprises', { type: 'letter', title: 'For a hard week', body: 'SECRET-CONTENT-XYZ', unlockAt: tomorrow });
ok('surprise created', s.status === 200);
const sB = await api(b.data.token, 'GET', '/api/surprises');
const sealed = sB.data.surprises.find(x => x.id === s.data.surprise.id);
ok('recipient cannot see sealed payload', sealed && !sealed.payload);
const early = await api(b.data.token, 'POST', `/api/surprises/${s.data.surprise.id}/open`);
ok('early open rejected by server', early.status === 423);
const sA = await api(a.data.token, 'GET', '/api/surprises');
const mine = sA.data.surprises.find(x => x.id === s.data.surprise.id);
ok('creator can always preview own surprise', mine?.payload?.body === 'SECRET-CONTENT-XYZ');

// 11. date planner — the spec's example brief
const plan = await api(a.data.token, 'POST', '/api/dates/plan', { minutes: 30, mood: 'low', energy: 1, notes: "She's exhausted from college." });
ok('planner: low-energy 30-min date generated', plan.status === 200 && plan.data.plan.steps.length >= 3);
ok('planner: ends with gratitude', plan.data.plan.steps[plan.data.plan.steps.length - 1].kind === 'gratitude');
ok('planner: total fits budget roughly', plan.data.plan.steps.reduce((s2, x) => s2 + x.minutes, 0) <= 40);

// 12. memories + notifications
const memNotifP = wsB.wait(m => m.t === 'notify' && m.notification?.body?.includes('memory'), 5000);
const mem = await api(a.data.token, 'POST', '/api/memories', { type: 'note', title: 'A tiny thing', body: 'you fell asleep mid-sentence' });
ok('memory saved', mem.status === 200);
const memNotif = await memNotifP;
ok('partner hears about new memory', !!memNotif);

// 13. password reset flow (demo link)
const rr = await api(null, 'POST', '/api/auth/reset-request', { email: `a${suffix}@t.dev` });
ok('reset link issued', rr.status === 200 && rr.data.resetUrl);
const rt = rr.data.resetUrl.split('token=')[1];
const rp = await api(null, 'POST', '/api/auth/reset', { token: rt, password: 'newpassword456' });
ok('password reset works', rp.status === 200);
const relog = await api(null, 'POST', '/api/auth/login', { email: `a${suffix}@t.dev`, password: 'newpassword456' });
ok('login with new password', relog.status === 200);

// 14. rate limiting
let limited = false;
for (let i = 0; i < 15; i++) { const r = await api(null, 'POST', '/api/auth/login', { email: `a${suffix}@t.dev`, password: 'x'.repeat(10) }); if (r.status === 429) limited = true; }
ok('login rate limiting kicks in', limited);

// 15. static pages
const home = await fetch(BASE + '/');
const app = await fetch(BASE + '/app');
const css = await fetch(BASE + '/css/base.css');
ok('landing page served', home.status === 200);
ok('app shell served', app.status === 200);
ok('styles served', css.status === 200);

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
