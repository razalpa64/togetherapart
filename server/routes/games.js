// Server-authoritative game engines: tic-tac-toe, connect four, memory match,
// and "duel" decks (would-you-rather / this-or-that) + shared drawing.
import { ok, fail, clean, now, id, shuffle } from '../lib/util.js';
import { T, one, save, byId } from '../lib/db.js';
import { decks } from '../content/decks.js';

const GLYPHS = ['☾', '✦', '♡', '✿', '☕', '☂', '✈', '⌛', '✉', '♩', '⌂', '✧'];

function newSession(coupleId, game, users) {
  const [a, b] = users;
  let state;
  if (game === 'ttt') state = { board: Array(9).fill(null), history: { [a]: 0, [b]: 0 } };
  if (game === 'c4') state = { board: Array(42).fill(null), moves: [] };
  if (game === 'memory') {
    const pairs = 8;
    const glyphs = shuffle(GLYPHS).slice(0, pairs);
    const deck = shuffle([...glyphs, ...glyphs]).map((g, i) => ({ i, g }));
    state = { deck, revealed: [], matched: [], scores: { [a]: 0, [b]: 0 } };
  }
  if (game === 'wyr' || game === 'thisthat') {
    const key = game === 'wyr' ? 'wyr' : 'thisorthat';
    const qs = shuffle(decks[key]).slice(0, 12).map(q => Array.isArray(q) ? { options: q } : { text: q });
    state = { qs, idx: 0, answers: {}, revealed: false, score: { both: 0, total: 0 } };
  }
  if (game === 'draw') state = { prompt: shuffle(decks.draw)[0], strokes: [], round: 1 };
  const s = {
    id: id('g'), coupleId, game, state,
    turn: game === 'draw' || game === 'wyr' || game === 'thisthat' ? null : a,
    status: 'active', winner: null, updatedAt: now(), createdAt: now(),
  };
  return s;
}

function checkTTT(b) {
  const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [x, y, z] of L) if (b[x] && b[x] === b[y] && b[y] === b[z]) return b[x];
  return b.every(Boolean) ? 'draw' : null;
}
function checkC4(b) {
  const at = (r, c) => (r >= 0 && r < 6 && c >= 0 && c < 7 ? b[r * 7 + c] : null);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    const v = at(r, c); if (!v) continue;
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      if (at(r+dr,c+dc)===v && at(r+2*dr,c+2*dc)===v && at(r+3*dr,c+3*dc)===v) return v;
    }
  }
  return b.every(Boolean) ? 'draw' : null;
}

export const routes = [
  ['POST', /^\/api\/games\/start$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const game = ['ttt', 'c4', 'memory', 'wyr', 'thisthat', 'draw'].includes(body.game) ? body.game : null;
    if (!game) return fail(res, 400, 'Unknown game.');
    if (!ctx.partner) return fail(res, 409, `You'll need ${ctx.couple ? 'your partner' : 'someone'} in the world first — invite them from Our Place.`);
    const users = [user.id, ctx.partner.userId];
    // reuse an in-progress session of the same game
    const existing = T('games').find(g => g.coupleId === ctx.coupleId && g.game === game && g.status === 'active');
    if (existing) {
      // ttt scores persist across rounds inside state.history
      return ok(res, { session: existing });
    }
    const s = newSession(ctx.coupleId, game, users);
    T('games').push(s);
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'game:state', session: s, started: true });
    return ok(res, { session: s });
  }],
  ['GET', /^\/api\/games\/([\w:-]+)$/, async ({ res, params, ctx }) => {
    const s = byId('games', params[0]);
    if (!s || s.coupleId !== ctx.coupleId) return fail(res, 404, 'That game is gone.');
    return ok(res, { session: s });
  }],
  ['POST', /^\/api\/games\/([\w:-]+)\/move$/, async ({ res, body, params, user, ctx }) => {
    const s = byId('games', params[0]);
    if (!s || s.coupleId !== ctx.coupleId) return fail(res, 404, 'That game is gone.');
    if (s.status !== 'active') return fail(res, 400, 'This game has finished — start a new round.');
    const st = s.state;
    const me = user.id;
    const other = ctx.partner ? ctx.partner.userId : null;

    if (s.game === 'ttt') {
      if (st.winner !== undefined && st.winner !== null) { /* round over, allow reset via /reset */ }
      if (s.turn !== me) return fail(res, 400, 'Their move first.');
      const i = Number(body.move);
      if (!Number.isInteger(i) || i < 0 || i > 8 || st.board[i]) return fail(res, 400, 'That square is taken.');
      st.board[i] = me;
      const w = checkTTT(st.board);
      if (w) {
        st.winner = w;
        if (w !== 'draw') st.history[me] = (st.history[me] || 0) + 1;
        s.status = 'done';
      } else s.turn = other;
    }

    else if (s.game === 'c4') {
      if (s.turn !== me) return fail(res, 400, 'Their move first.');
      const col = Number(body.move);
      if (!Number.isInteger(col) || col < 0 || col > 6) return fail(res, 400, 'Not a column.');
      let row = -1;
      for (let r = 5; r >= 0; r--) if (!st.board[r * 7 + col]) { row = r; break; }
      if (row < 0) return fail(res, 400, 'That column is full.');
      st.board[row * 7 + col] = me;
      st.lastMove = row * 7 + col;
      const w = checkC4(st.board);
      if (w) { st.winner = w; s.winner = w; s.status = 'done'; }
      else s.turn = other;
    }

    else if (s.game === 'memory') {
      if (st.turn !== me) return fail(res, 400, 'Their turn first.');
      const i = Number(body.move);
      const card = st.deck.find(c => c.i === i);
      if (!card || st.matched.includes(card.g) || st.revealed.includes(i)) return fail(res, 400, 'Pick a hidden card.');
      st.revealed.push(i);
      if (st.revealed.length === 2) {
        const [x, y] = st.revealed;
        const gx = st.deck.find(c => c.i === x).g, gy = st.deck.find(c => c.i === y).g;
        if (gx === gy) {
          st.matched.push(gx);
          st.scores[me] = (st.scores[me] || 0) + 1;
          st.revealed = [];
          if (st.matched.length === st.deck.length / 2) { st.winner = 'done'; s.status = 'done'; }
        } else {
          st.turn = other;
          // flip back after a beat; server broadcasts the mismatch state so both screens agree
          setTimeout(() => {
            if (st.revealed.length === 2) { st.revealed = []; s.updatedAt = now(); save(); ctx.rt.broadcastCouple(ctx.coupleId, { t: 'game:state', session: s }); }
          }, 1100);
        }
      }
    }

    else if (s.game === 'wyr' || s.game === 'thisthat') {
      const q = st.qs[st.idx];
      if (!q) return fail(res, 400, 'The deck ran out.');
      if (body.action === 'next') {
        if (st.idx < st.qs.length - 1) { st.idx++; st.answers = {}; st.revealed = false; }
        else { st.finished = true; s.status = 'done'; }
      } else {
        const choice = Number(body.move);
        if (q.options ? (choice !== 0 && choice !== 1) : typeof body.move !== 'string') return fail(res, 400, 'Pick one.');
        st.answers[me] = q.options ? choice : clean(body.move, 300);
        const answers = Object.keys(st.answers);
        if (answers.length >= 2) {
          st.revealed = true;
          st.score.total++;
          const [u1, u2] = answers;
          if (st.answers[u1] === st.answers[u2]) st.score.both++;
        }
      }
    }

    else if (s.game === 'draw') {
      if (body.action === 'stroke' && Array.isArray(body.stroke)) {
        const pts = body.stroke.slice(0, 600).map(p => [Math.round(Number(p[0]) || 0), Math.round(Number(p[1]) || 0)]);
        st.strokes.push({ by: me, color: clean(body.color, 12) || '#26201c', size: Math.min(Number(body.size) || 3, 30), pts });
        if (st.strokes.length > 400) st.strokes.shift();
      } else if (body.action === 'clear') st.strokes = [];
      else if (body.action === 'next') { st.strokes = []; st.prompt = shuffle(decks.draw.filter(p => p !== st.prompt))[0]; st.round++; }
    }

    s.updatedAt = now();
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'game:state', session: s, by: me });
    ctx.rt.touch(me, { activity: 'Playing ' + ({ ttt: 'tic tac toe', c4: 'connect four', memory: 'memory match', wyr: 'would you rather', thisthat: 'this or that', draw: 'the drawing game' }[s.game]) });
    return ok(res, { session: s });
  }],
  ['POST', /^\/api\/games\/([\w:-]+)\/reset$/, async ({ res, params, user, ctx }) => {
    const s = byId('games', params[0]);
    if (!s || s.coupleId !== ctx.coupleId) return fail(res, 404, 'That game is gone.');
    const fresh = newSession(ctx.coupleId, s.game, [user.id, ctx.partner?.userId].filter(Boolean));
    fresh.id = s.id; fresh.createdAt = s.createdAt;
    if (s.game === 'ttt') fresh.state.history = s.state.history || fresh.state.history; // keep series score
    const i = T('games').indexOf(s);
    T('games')[i] = fresh;
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'game:state', session: fresh, started: true });
    return ok(res, { session: fresh });
  }],
];
