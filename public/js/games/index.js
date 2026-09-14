// Shared games — server-authoritative with client-side fallback for offline / solo play.
import { api } from '../api.js';
import { store, partner } from '../state.js';
import { on } from '../bus.js';
import { send } from '../ws.js';
import { h, icon, toast } from '../ui.js';

export async function renderGame(container, game, onExit) {
  let session = null;
  const offs = [];
  const meId = store.me?.user?.id || 'me';
  const them = partner();
  const themName = them?.displayName || 'Partner';

  const head = h('div', { class: 'game-head' });
  const stage = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' } });
  container.replaceChildren(h('div', { class: 'game-wrap' }, head, stage));

  async function start() {
    try {
      const d = await api('POST', '/api/games/start', { game });
      session = d.session;
      draw();
    } catch (e) {
      // Create fallback session for solo play / offline mode
      session = createLocalSession(game, meId, them?.userId || 'partner');
      draw();
    }
  }

  async function move(payload) {
    try {
      const d = await api('POST', `/api/games/${session.id}/move`, payload);
      session = d.session;
      draw();
    } catch (e) {
      processLocalMove(session, meId, payload);
      draw();
    }
  }

  function draw() {
    if (!session) return;
    const st = session.state;
    const myTurn = session.turn === meId;
    const titles = {
      ttt: 'Tic Tac Toe', c4: 'Connect Four', memory: 'Memory Match', wyr: 'Would You Rather',
      thisthat: 'This or That', draw: 'The Drawing Game', chess: 'Chess Duel', checkers: 'Checkers',
      wordle: 'Word Guess Duel', trivia: 'Couple\'s Trivia', rps: 'Rock Paper Scissors Spock'
    };
    const title = titles[session.game] || session.game;
    head.replaceChildren(
      h('div', {},
        h('h2', { class: 'h2' }, title),
        h('p', { class: 'small muted', style: { marginTop: '2px' } },
          ['draw','wyr','thisthat','wordle','trivia','rps'].includes(session.game) ? 'shared deck / simultaneous play' : myTurn ? 'your move' : `${themName}'s move…`)),
      h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '8px' } },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => {
          try {
            const d = await api('POST', `/api/games/${session.id}/reset`);
            session = d.session;
          } catch {
            session = createLocalSession(game, meId, them?.userId || 'partner');
          }
          draw();
        } }, h('span', { html: icon('refresh', 14) }), 'New round'),
        onExit ? h('button', { class: 'btn btn-ghost btn-sm', onclick: onExit }, 'Back') : ''));

    const renderers = {
      ttt: drawTTT, c4: drawC4, memory: drawMemory, wyr: drawDuel, thisthat: drawDuel, draw: drawDraw,
      chess: drawChess, checkers: drawCheckers, wordle: drawWordle, trivia: drawTrivia, rps: drawRPS
    };
    (renderers[session.game] || (() => {}))(st);
  }

  /* ---------- tic tac toe ---------- */
  function drawTTT(st) {
    const done = st.winner !== undefined && st.winner !== null;
    const grid = h('div', { class: 'ttt-board', role: 'grid' });
    st.board.forEach((cell, i) => {
      const btn = h('button', {
        class: 'ttt-cell' + (cell === meId ? ' x' : cell ? ' o' : ''),
        disabled: !!cell || done || (session.turn && session.turn !== meId),
        'aria-label': 'square ' + (i + 1),
        onclick: () => move({ move: i }),
      }, cell ? (cell === meId ? '✕' : '◯') : '');
      grid.append(btn);
    });
    const scores = st.history || {};
    stage.replaceChildren(grid,
      h('div', { class: 'score' }, `series — you ${scores[meId] || 0} : ${scores[them?.userId || 'partner'] || 0} ${themName}`),
      done ? endNote(st.winner === 'draw' ? 'A draw. Rematch?' : st.winner === meId ? 'You win this one.' : `${themName} takes it.`) : '');
  }

  /* ---------- connect four ---------- */
  function drawC4(st) {
    const done = st.winner && st.winner !== null;
    const drops = h('div', { class: 'c4-drop' }, [0, 1, 2, 3, 4, 5, 6].map(c =>
      h('button', { 'aria-label': 'drop in column ' + (c + 1), disabled: done || (session.turn && session.turn !== meId), onclick: () => move({ move: c }) }, '↓')));
    const board = h('div', { class: 'c4-board' });
    const winLine = done && st.winner !== 'draw' ? findWinLine(st.board) : new Set();
    st.board.forEach((cell, i) => {
      board.append(h('div', { class: 'c4-cell' + (cell ? (cell === meId ? ' a' : ' b') : '') + (winLine.has(i) ? ' win' : '') }));
    });
    stage.replaceChildren(drops, board,
      done ? endNote(st.winner === 'draw' ? 'Full board. Nobody blinked.' : st.winner === meId ? 'Four in a row — yours.' : `${themName} connects four.`) : '');
  }
  function findWinLine(b) {
    const at = (r, c) => (r >= 0 && r < 6 && c >= 0 && c < 7 ? b[r * 7 + c] : null);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
      const v = at(r, c); if (!v) continue;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const line = [r * 7 + c];
        for (let k = 1; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (at(rr, cc) === v) line.push(rr * 7 + cc); }
        if (line.length === 4) return new Set(line);
      }
    }
    return new Set();
  }

  /* ---------- memory match ---------- */
  function drawMemory(st) {
    const grid = h('div', { class: 'mem-grid', role: 'grid' });
    st.deck.forEach(card => {
      const matched = st.matched.includes(card.g);
      const revealed = st.revealed.includes(card.i);
      const el = h('button', {
        class: 'mem-card' + (revealed || matched ? ' flip' : '') + (matched ? ' matched' : ''),
        'aria-label': matched ? 'matched card' : 'hidden card',
        disabled: matched || revealed || (st.turn && st.turn !== meId),
        onclick: () => move({ move: card.i }),
      },
        h('span', { class: 'back' }, '✦'),
        h('span', { class: 'front' }, card.g));
      grid.append(el);
    });
    const s = st.scores || {};
    stage.replaceChildren(grid,
      h('div', { class: 'score' }, `pairs — you ${s[meId] || 0} : ${s[them?.userId || 'partner'] || 0} ${themName}`),
      st.winner ? endNote('All pairs found. ' + ((s[meId] || 0) > (s[them?.userId] || 0) ? 'You take it.' : (s[meId] || 0) < (s[them?.userId] || 0) ? `${themName} takes it.` : 'Dead even.')) : '');
  }

  /* ---------- would you rather / this or that ---------- */
  function drawDuel(st) {
    const q = st.qs[st.idx];
    if (!q) { stage.replaceChildren(endNote('That\'s the deck. You made it through.')); return; }
    const myAnswer = st.answers?.[meId];
    const theirAnswer = st.answers?.[them?.userId || 'partner'];
    const both = st.revealed;
    const opts = q.options || null;
    const answered = myAnswer !== undefined;

    const box = h('div', { class: 'duel-q' },
      h('span', { class: 'date-step-num' }, (st.idx + 1) + ' / ' + st.qs.length),
      h('div', { class: 'q' }, opts ? (q.options[0] + ' — or — ' + q.options[1]) : q.text));

    if (opts) {
      box.append(h('div', { class: 'duel-opts' }, q.options.map((o, i) => {
        const mine = myAnswer === i;
        const theirs = both && theirAnswer === i;
        return h('button', {
          class: 'duel-opt' + (mine ? ' mine' : '') + (both && mine && theirs ? ' both' : ''),
          disabled: answered,
          onclick: () => move({ move: i }),
        }, o + (mine ? ' · you' : '') + (both && theirs && !mine ? ' · them' : '') + (both && mine && theirs ? ' · both!' : ''));
      })));
    } else {
      const ta = h('input', { class: 'input', placeholder: answered ? 'waiting for them…' : 'your answer', disabled: answered, style: { maxWidth: '340px' } });
      const go = h('button', { class: 'btn btn-primary', disabled: answered, onclick: () => { if (ta.value.trim()) move({ move: ta.value.trim() }); } }, 'Answer');
      box.append(h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } }, ta, go));
      if (both) box.append(h('div', { class: 'soft-card', style: { marginTop: '14px', textAlign: 'left' } },
        h('div', { class: 'small' }, h('b', {}, 'You: '), String(myAnswer ?? '—')),
        h('div', { class: 'small' }, h('b', {}, themName + ': '), String(theirAnswer ?? '—'))));
    }
    if (answered && !both) box.append(h('p', { class: 'small muted', style: { marginTop: '14px' } }, 'Answer locked in. Waiting for ' + themName + '…'));
    if (both) box.append(h('button', { class: 'btn btn-primary', style: { marginTop: '16px' }, onclick: () => move({ action: 'next' }) }, 'Next question'));
    stage.replaceChildren(box);
  }

  /* ---------- drawing game ---------- */
  function drawDraw(st) {
    const W = 640, H = 400;
    const canvas = h('canvas', { width: W, height: H, 'aria-label': 'shared drawing canvas' });
    const ctx = canvas.getContext('2d');
    const colors = ['#27211A', '#B4766B', '#B98A44', '#7D8471', '#96525B', '#E8C9A8'];
    let color = colors[0], size = 3;
    const prompt = h('div', { class: 'soft-card', style: { display: 'flex', gap: '12px', alignItems: 'center' } },
      h('span', { class: 'tag' }, 'draw this'), h('span', { class: 'serif', style: { fontSize: '1.15rem' } }, st.prompt || 'anything at all'));

    const tools = h('div', { class: 'draw-tools' },
      colors.map(c => h('button', { class: 'swatch' + (c === color ? ' on' : ''), style: { background: c }, 'aria-label': 'color ' + c, onclick: (e) => { color = c; tools.querySelectorAll('.swatch').forEach(s => s.classList.remove('on')); e.currentTarget.classList.add('on'); } })),
      h('button', { class: 'chip', onclick: () => move({ action: 'clear' }) }, 'Clear'),
      h('button', { class: 'chip', onclick: () => move({ action: 'next' }) }, 'New prompt'));
    const wrap = h('div', { class: 'draw-canvas-wrap' }, canvas);

    function paint() {
      ctx.fillStyle = '#FFFDF7';
      ctx.fillRect(0, 0, W, H);
      for (const s of (st.strokes || [])) {
        ctx.strokeStyle = s.color; ctx.lineWidth = s.size || 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        s.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        if (s.pts.length === 1) { ctx.arc(s.pts[0][0], s.pts[0][1], (s.size || 3) / 2, 0, 7); ctx.fillStyle = s.color; ctx.fill(); }
        ctx.stroke();
      }
    }
    paint();

    let drawing = false, pts = [];
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return [Math.round((p.clientX - r.left) / r.width * W), Math.round((p.clientY - r.top) / r.height * H)];
    };
    const down = (e) => { e.preventDefault(); drawing = true; pts = [pos(e)]; };
    const mv = (e) => { if (!drawing) return; e.preventDefault(); pts.push(pos(e)); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...pts[pts.length - 2]); ctx.lineTo(...pts[pts.length - 1]); ctx.stroke(); };
    const up = () => { if (!drawing) return; drawing = false; move({ action: 'stroke', stroke: pts, color, size }); };
    canvas.addEventListener('mousedown', down); canvas.addEventListener('mousemove', mv);
    addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false }); canvas.addEventListener('touchmove', mv, { passive: false }); canvas.addEventListener('touchend', up);

    stage.replaceChildren(prompt, wrap, tools);
  }

  /* ---------- chess ---------- */
  let selectedSquare = null;
  function drawChess(st) {
    const SYMBOLS = { R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔', P: '♙', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟' };
    const board = h('div', { class: 'chess-board', style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px', width: '320px', height: '320px', background: 'var(--border)', border: '2px solid var(--border)', borderRadius: '8px', overflow: 'hidden' } });
    st.board.forEach((piece, i) => {
      const row = Math.floor(i / 8), col = i % 8;
      const isDark = (row + col) % 2 === 1;
      const isSelected = selectedSquare === i;
      const btn = h('button', {
        class: 'chess-cell',
        style: {
          background: isSelected ? 'var(--gold-soft, #fef3c7)' : isDark ? '#b58863' : '#f0d9b5',
          fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', border: 'none'
        },
        onclick: () => {
          if (selectedSquare === null) {
            if (piece) { selectedSquare = i; draw(); }
          } else {
            if (selectedSquare === i) { selectedSquare = null; draw(); }
            else {
              const from = selectedSquare;
              selectedSquare = null;
              move({ from, to: i });
            }
          }
        }
      }, piece ? (SYMBOLS[piece] || piece) : '');
      board.append(btn);
    });
    stage.replaceChildren(board, h('p', { class: 'small muted' }, selectedSquare !== null ? 'Click a target square to move piece' : 'Click a piece to select it'));
  }

  /* ---------- checkers ---------- */
  let selectedChecker = null;
  function drawCheckers(st) {
    const board = h('div', { class: 'checkers-board', style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px', width: '320px', height: '320px', background: 'var(--border)', border: '2px solid var(--border)', borderRadius: '8px', overflow: 'hidden' } });
    st.board.forEach((piece, i) => {
      const row = Math.floor(i / 8), col = i % 8;
      const isDark = (row + col) % 2 === 1;
      const isSelected = selectedChecker === i;
      const sym = piece === 'r' ? '🔴' : piece === 'rk' ? '👑🔴' : piece === 'b' ? '⚪' : piece === 'bk' ? '👑⚪' : '';
      const btn = h('button', {
        class: 'checker-cell',
        style: {
          background: isSelected ? 'var(--gold-soft, #fef3c7)' : isDark ? '#769656' : '#eeeed2',
          fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', border: 'none'
        },
        onclick: () => {
          if (selectedChecker === null) {
            if (piece) { selectedChecker = i; draw(); }
          } else {
            if (selectedChecker === i) { selectedChecker = null; draw(); }
            else {
              const from = selectedChecker;
              selectedChecker = null;
              move({ from, to: i });
            }
          }
        }
      }, sym);
      board.append(btn);
    });
    stage.replaceChildren(board, h('p', { class: 'small muted' }, selectedChecker !== null ? 'Click target square to move' : 'Click a piece to select it'));
  }

  /* ---------- wordle duel ---------- */
  function drawWordle(st) {
    const guessesBox = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '340px' } });
    st.guesses.forEach(g => {
      const row = h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center' } });
      const sec = st.secret.split('');
      g.word.split('').forEach((ch, idx) => {
        let bg = 'var(--bg-3)';
        if (ch === sec[idx]) bg = '#38a169';
        else if (sec.includes(ch)) bg = '#d69e2e';
        else bg = '#718096';
        row.append(h('div', { style: { width: '38px', height: '38px', background: bg, color: '#fff', fontWeight: 'bold', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' } }, ch));
      });
      guessesBox.append(row);
    });

    const inp = h('input', { class: 'input', placeholder: '6-LETTER WORD', maxlength: '6', style: { width: '200px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.1em', fontSize: '1.2rem' } });
    const sub = h('button', { class: 'btn btn-primary', onclick: () => { if (inp.value.length === 6) move({ guess: inp.value }); } }, 'Guess');

    stage.replaceChildren(guessesBox,
      st.solved ? endNote('🎉 Secret word guessed! Word: ' + st.secret) :
      st.guesses.length >= st.maxGuesses ? endNote('Wordle complete! The word was: ' + st.secret) :
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } }, inp, sub));
  }

  /* ---------- couple trivia ---------- */
  function drawTrivia(st) {
    const q = st.qs[st.idx];
    if (!q) { stage.replaceChildren(endNote('Quiz finished! Great job!')); return; }
    const answered = st.answers?.[meId] !== undefined;
    const box = h('div', { class: 'card card-pad', style: { maxWidth: '440px', textAlign: 'center' } },
      h('span', { class: 'tag', style: { marginBottom: '10px', display: 'inline-block' } }, `Question ${st.idx + 1} of ${st.qs.length}`),
      h('h3', { class: 'h3', style: { marginBottom: '16px' } }, q.q),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, q.options.map((opt, i) =>
        h('button', {
          class: 'btn ' + (st.answers?.[meId] === i ? 'btn-primary' : 'btn-ghost'),
          disabled: answered,
          onclick: () => move({ move: i })
        }, opt)
      ))
    );
    if (st.revealed) {
      box.append(h('button', { class: 'btn btn-primary', style: { marginTop: '14px' }, onclick: () => move({ action: 'next' }) }, 'Next Question'));
    } else if (answered) {
      box.append(h('p', { class: 'small muted', style: { marginTop: '12px' } }, 'Waiting for partner...'));
    }
    stage.replaceChildren(box);
  }

  /* ---------- rock paper scissors spock ---------- */
  function drawRPS(st) {
    const opts = [
      { id: 'rock', emoji: '✊', label: 'Rock' },
      { id: 'paper', emoji: '✋', label: 'Paper' },
      { id: 'scissors', emoji: '✌️', label: 'Scissors' },
      { id: 'spock', emoji: '🖖', label: 'Spock' }
    ];
    const myChoice = st.choices?.[meId];
    const box = h('div', { class: 'card card-pad', style: { textAlign: 'center', maxWidth: '400px' } },
      h('h3', { class: 'h3', style: { marginBottom: '14px' } }, `Round ${st.round}`),
      h('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' } }, opts.map(o =>
        h('button', {
          class: 'btn ' + (myChoice === o.id ? 'btn-primary' : 'btn-subtle'),
          style: { fontSize: '1.2rem', padding: '12px 18px' },
          disabled: !!myChoice,
          onclick: () => move({ move: o.id })
        }, o.emoji + ' ' + o.label)
      ))
    );
    if (st.revealed) {
      box.append(
        h('div', { class: 'soft-card', style: { marginTop: '14px' } },
          h('p', { class: 'serif', style: { fontSize: '1.2rem' } }, 'Choices revealed!'),
          h('button', { class: 'btn btn-primary btn-sm', style: { marginTop: '10px' }, onclick: () => move({ action: 'next' }) }, 'Next Round')
        )
      );
    } else if (myChoice) {
      box.append(h('p', { class: 'small muted', style: { marginTop: '12px' } }, 'Choice locked in! Waiting for partner...'));
    }
    stage.replaceChildren(box);
  }

  function endNote(text) {
    return h('div', { class: 'soft-card', style: { textAlign: 'center' } }, h('span', { class: 'serif' }, text));
  }

  offs.push(on('game:state', (m) => {
    if (!session || m.session.id !== session.id) return;
    session = m.session;
    draw();
  }));

  start();
  return { destroy() { offs.forEach(off => off()); } };
}

/* Local Session Helper for Solo / Practice Mode */
function createLocalSession(game, p1, p2) {
  let state = {};
  if (game === 'ttt') state = { board: Array(9).fill(null), history: { [p1]: 0, [p2]: 0 } };
  else if (game === 'c4') state = { board: Array(42).fill(null), moves: [] };
  else if (game === 'memory') {
    const GLYPHS = ['☾', '✦', '♡', '✿', '☕', '☂', '✈', '⌛'];
    const deck = [...GLYPHS, ...GLYPHS].sort(() => Math.random() - 0.5).map((g, i) => ({ i, g }));
    state = { deck, revealed: [], matched: [], scores: { [p1]: 0, [p2]: 0 } };
  }
  else if (game === 'wyr' || game === 'thisthat') {
    const qs = [
      { options: ['Spontaneous road trip', 'Planned luxury resort stay'] },
      { options: ['Late night deep talks', 'Early morning coffee dates'] },
      { options: ['Cook a gourmet meal together', 'Order favorite takeout'] },
      { options: ['Watch sunset on a beach', 'Watch stargazing in mountains'] }
    ];
    state = { qs, idx: 0, answers: {}, revealed: false, score: { both: 0, total: 0 } };
  }
  else if (game === 'draw') state = { prompt: 'A cozy house with hearts floating', strokes: [], round: 1 };
  else if (game === 'chess') {
    state = {
      board: [
        'r','n','b','q','k','b','n','r',
        'p','p','p','p','p','p','p','p',
        null,null,null,null,null,null,null,null,
        null,null,null,null,null,null,null,null,
        null,null,null,null,null,null,null,null,
        null,null,null,null,null,null,null,null,
        'P','P','P','P','P','P','P','P',
        'R','N','B','Q','K','B','N','R'
      ]
    };
  }
  else if (game === 'checkers') {
    const board = Array(64).fill(null);
    [1,3,5,7,8,10,12,14,17,19,21,23].forEach(i => board[i] = 'b');
    [40,42,44,46,49,51,53,55,56,58,60,62].forEach(i => board[i] = 'r');
    state = { board };
  }
  else if (game === 'wordle') {
    state = { secret: 'COUPLE', guesses: [], maxGuesses: 6, solved: false };
  }
  else if (game === 'trivia') {
    state = {
      qs: [
        { q: "Where was your very first date or meeting?", options: ["Café / Coffee", "Park / Walk", "Movie / Dinner", "Online / Video Call"] },
        { q: "What's the best time of day for you two to talk?", options: ["Morning Coffee", "Afternoon Break", "Late Night", "Whenever free!"] },
        { q: "What is your favorite activity on date night?", options: ["Cooking & Movie", "Gaming together", "Stargazing & Long talks", "Music & Dancing"] }
      ],
      idx: 0, answers: {}, scores: { [p1]: 0, [p2]: 0 }
    };
  }
  else if (game === 'rps') {
    state = { choices: {}, round: 1, scores: { [p1]: 0, [p2]: 0 } };
  }

  return {
    id: 'local_' + Date.now(),
    game,
    turn: p1,
    state
  };
}

function processLocalMove(session, meId, payload) {
  const st = session.state;
  const game = session.game;

  if (game === 'ttt') {
    if (st.board[payload.move] === null) {
      st.board[payload.move] = meId;
      session.turn = session.turn === meId ? 'partner' : meId;
    }
  } else if (game === 'c4') {
    const col = payload.move;
    for (let r = 5; r >= 0; r--) {
      if (!st.board[r * 7 + col]) {
        st.board[r * 7 + col] = meId;
        break;
      }
    }
  } else if (game === 'memory') {
    const i = payload.move;
    if (!st.revealed.includes(i)) {
      st.revealed.push(i);
      if (st.revealed.length === 2) {
        const [x, y] = st.revealed;
        const gx = st.deck.find(c => c.i === x).g, gy = st.deck.find(c => c.i === y).g;
        if (gx === gy) {
          st.matched.push(gx);
          st.scores[meId] = (st.scores[meId] || 0) + 1;
          st.revealed = [];
          if (st.matched.length === st.deck.length / 2) st.winner = 'done';
        } else {
          setTimeout(() => { st.revealed = []; }, 1000);
        }
      }
    }
  } else if (game === 'wyr' || game === 'thisthat') {
    if (payload.action === 'next') {
      if (st.idx < st.qs.length - 1) { st.idx++; st.answers = {}; st.revealed = false; }
    } else {
      st.answers[meId] = payload.move;
      st.answers['partner'] = Math.floor(Math.random() * 2);
      st.revealed = true;
    }
  } else if (game === 'draw') {
    if (payload.action === 'stroke') {
      st.strokes.push({ by: meId, color: payload.color || '#27211A', size: payload.size || 3, pts: payload.stroke });
    } else if (payload.action === 'clear') st.strokes = [];
    else if (payload.action === 'next') { st.strokes = []; st.round++; }
  } else if (game === 'chess') {
    const { from, to } = payload;
    if (from !== undefined && to !== undefined) {
      st.board[to] = st.board[from];
      st.board[from] = null;
    }
  } else if (game === 'checkers') {
    const { from, to } = payload;
    if (from !== undefined && to !== undefined) {
      st.board[to] = st.board[from];
      st.board[from] = null;
    }
  } else if (game === 'wordle') {
    const g = (payload.guess || '').toUpperCase();
    if (g.length === 6) {
      st.guesses.push({ word: g, by: meId });
      if (g === st.secret) st.solved = true;
    }
  } else if (game === 'trivia') {
    if (payload.action === 'next') {
      if (st.idx < st.qs.length - 1) { st.idx++; st.answers = {}; st.revealed = false; }
    } else {
      st.answers[meId] = payload.move;
      st.revealed = true;
    }
  } else if (game === 'rps') {
    if (payload.action === 'next') {
      st.choices = {}; st.revealed = false; st.round++;
    } else {
      st.choices[meId] = payload.move;
      st.choices['partner'] = ['rock','paper','scissors','spock'][Math.floor(Math.random() * 4)];
      st.revealed = true;
    }
  }
}
