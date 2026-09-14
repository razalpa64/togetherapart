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

  if (game === 'chess') {
    const board = [
      'r','n','b','q','k','b','n','r',
      'p','p','p','p','p','p','p','p',
      null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,
      null,null,null,null,null,null,null,null,
      'P','P','P','P','P','P','P','P',
      'R','N','B','Q','K','B','N','R'
    ];
    state = { board, white: a, black: b, captured: { W: [], B: [] } };
  }

  if (game === 'checkers') {
    const board = Array(64).fill(null);
    [1,3,5,7,8,10,12,14,17,19,21,23].forEach(i => board[i] = 'b');
    [40,42,44,46,49,51,53,55,56,58,60,62].forEach(i => board[i] = 'r');
    state = { board, red: a, black: b };
  }

  if (game === 'wordle') {
    const WORDS = ['COUPLE', 'ALWAYS', 'WARMTH', 'FLAME', 'LOVING', 'FOREVER', 'UNITED', 'HEARTS', 'SHARED'];
    const secret = shuffle(WORDS)[0];
    state = { secret, guesses: [], maxGuesses: 6, solved: false };
  }

  if (game === 'trivia') {
    const TRIVIA_BANK = [
      { q: "Where was your very first date or meeting?", options: ["Café / Coffee", "Park / Walk", "Movie / Dinner", "Online / Video Call"] },
      { q: "What's the best time of day for you two to talk?", options: ["Morning Coffee", "Afternoon Break", "Late Night", "Whenever free!"] },
      { q: "Who usually calls or texts first in the morning?", options: ["Partner A", "Partner B", "Both equally", "Depends on alarm!"] },
      { q: "What is your dream vacation destination together?", options: ["Cozy Alpine Cabin", "Tropical Beach Resort", "Historic City Tour", "Quiet Countryside"] },
      { q: "What is your favorite activity on date night?", options: ["Cooking & Movie", "Gaming together", "Stargazing & Long talks", "Music & Dancing"] }
    ];
    state = { qs: shuffle(TRIVIA_BANK), idx: 0, answers: {}, scores: { [a]: 0, [b]: 0 } };
  }

  if (game === 'rps') {
    state = { choices: {}, round: 1, scores: { [a]: 0, [b]: 0 } };
  }

  const s = {
    id: id('g'), coupleId, game, state,
    turn: ['draw','wyr','thisthat','wordle','trivia','rps'].includes(game) ? null : a,
    status: 'active', winner: null, updatedAt: now(), createdAt: now(),
  };
  return s;
}

export const routes = [
  ['POST', /^\/api\/games\/start$/, async ({ res, body, user, ctx }) => {
    if (!ctx.coupleId) return fail(res, 409, 'Create your world first.');
    const validGames = ['ttt', 'c4', 'memory', 'wyr', 'thisthat', 'draw', 'chess', 'checkers', 'wordle', 'trivia', 'rps'];
    const game = validGames.includes(body.game) ? body.game : null;
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

    else if (s.game === 'chess') {
      if (s.turn !== me) return fail(res, 400, 'Their turn first.');
      const { from, to } = body;
      if (from === undefined || to === undefined || !st.board[from]) return fail(res, 400, 'Select a piece to move.');
      const dest = st.board[to];
      if (dest) {
        const side = dest === dest.toUpperCase() ? 'W' : 'B';
        st.captured[side] = st.captured[side] || [];
        st.captured[side].push(dest);
      }
      st.board[to] = st.board[from];
      st.board[from] = null;
      s.turn = other;
    }

    else if (s.game === 'checkers') {
      if (s.turn !== me) return fail(res, 400, 'Their turn first.');
      const { from, to } = body;
      if (from === undefined || to === undefined || !st.board[from]) return fail(res, 400, 'Select a piece.');
      const piece = st.board[from];
      st.board[to] = piece;
      st.board[from] = null;
      // jump removal
      const diff = Math.abs(to - from);
      if (diff === 14 || diff === 18) {
        const mid = (from + to) / 2;
        st.board[mid] = null;
      }
      // kinging
      if (piece === 'r' && to <= 7) st.board[to] = 'rk';
      if (piece === 'b' && to >= 56) st.board[to] = 'bk';
      s.turn = other;
    }

    else if (s.game === 'wordle') {
      const g = clean(body.guess || '', 8).toUpperCase();
      if (!g || g.length !== 6) return fail(res, 400, 'Guess a 6-letter word.');
      st.guesses.push({ word: g, by: me });
      if (g === st.secret) { st.solved = true; s.status = 'done'; s.winner = me; }
      else if (st.guesses.length >= st.maxGuesses) { s.status = 'done'; s.winner = 'nobody'; }
    }

    else if (s.game === 'trivia') {
      if (body.action === 'next') {
        if (st.idx < st.qs.length - 1) { st.idx++; st.answers = {}; st.revealed = false; }
        else { s.status = 'done'; }
      } else {
        const choice = Number(body.move);
        st.answers[me] = choice;
        const keys = Object.keys(st.answers);
        if (keys.length >= 2) {
          st.revealed = true;
          // check if both chose correctly or matched
          keys.forEach(k => { st.scores[k] = (st.scores[k] || 0) + 1; });
        }
      }
    }

    else if (s.game === 'rps') {
      const move = clean(body.move, 12);
      if (!['rock','paper','scissors','spock'].includes(move)) return fail(res, 400, 'Invalid move.');
      st.choices[me] = move;
      const keys = Object.keys(st.choices);
      if (keys.length >= 2) {
        st.revealed = true;
        const [p1, p2] = keys;
        const m1 = st.choices[p1], m2 = st.choices[p2];
        if (m1 !== m2) {
          const wins = { rock: ['scissors'], paper: ['rock'], scissors: ['paper'], spock: ['rock','scissors'] };
          if (wins[m1]?.includes(m2)) st.scores[p1] = (st.scores[p1] || 0) + 1;
          else st.scores[p2] = (st.scores[p2] || 0) + 1;
        }
      }
      if (body.action === 'next') {
        st.choices = {}; st.revealed = false; st.round++;
      }
    }

    s.updatedAt = now();
    save();
    ctx.rt.broadcastCouple(ctx.coupleId, { t: 'game:state', session: s, by: me });
    ctx.rt.touch(me, { activity: 'Playing ' + s.game });
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
