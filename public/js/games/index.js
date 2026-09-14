// COUPLE'S GAMES ENGINE — Rebuilt from scratch.
// Interactive, stateful, synced & solo practice supported for all 11 couple games.
import { api } from '../api.js';
import { store, partner } from '../state.js';
import { on } from '../bus.js';
import { send } from '../ws.js';
import { h, icon, toast } from '../ui.js';

export async function renderGame(container, game, onExit) {
  let session = null;
  const offs = [];
  const meId = store.me?.user?.id || 'me';
  const partnerUser = partner();
  const partnerName = partnerUser?.displayName || 'Partner';

  const head = h('div', { class: 'game-head', style: { width: '100%', marginBottom: '18px' } });
  const stage = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' } });
  container.replaceChildren(h('div', { class: 'game-wrap', style: { width: '100%' } }, head, stage));

  async function start() {
    try {
      const d = await api('POST', '/api/games/start', { game });
      session = d.session;
      draw();
    } catch {
      session = buildLocalSession(game, meId, partnerUser?.userId || 'partner');
      draw();
    }
  }

  async function move(payload) {
    try {
      const d = await api('POST', `/api/games/${session.id}/move`, payload);
      session = d.session;
      draw();
    } catch {
      applyLocalMove(session, meId, payload);
      draw();
    }
  }

  function draw() {
    if (!session) return;
    const st = session.state;
    const isMyTurn = session.turn === meId || !session.turn;
    const TITLES = {
      chess: '♟️ Chess Duel', checkers: '🎯 Checkers', wordle: '🔤 Word Guess Duel',
      trivia: '💡 Couple\'s Trivia', rps: '✌️ RPS Spock Duel', ttt: '⭕ Tic Tac Toe',
      c4: '🔴 Connect Four', memory: '🧠 Memory Match', wyr: '🤔 Would You Rather',
      thisthat: '⚡ This or That', draw: '✏️ Drawing Game'
    };

    head.replaceChildren(
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' } },
        h('div', {},
          h('h2', { class: 'display-2', style: { fontSize: '1.6rem' } }, TITLES[session.game] || session.game),
          h('p', { class: 'small muted', style: { marginTop: '2px' } }, isMyTurn ? 'Your turn to move!' : `Waiting for ${partnerName}...`)),
        h('div', { style: { display: 'flex', gap: '8px' } },
          h('button', { class: 'btn btn-subtle btn-sm', onclick: () => start() }, h('span', { html: icon('refresh', 14) }), 'New Round'),
          onExit ? h('button', { class: 'btn btn-ghost btn-sm', onclick: onExit }, 'Exit Game') : '')
      )
    );

    const renderers = {
      chess: renderChess, checkers: renderCheckers, wordle: renderWordle,
      trivia: renderTrivia, rps: renderRPS, ttt: renderTTT,
      c4: renderC4, memory: renderMemory, wyr: renderDuel,
      thisthat: renderDuel, draw: renderDraw
    };

    (renderers[session.game] || (() => {}))(st);
  }

  /* 1. CHESS DUEL */
  let selectedChessSquare = null;
  function renderChess(st) {
    const SYMBOLS = { R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔', P: '♙', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟' };
    const board = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', width: 'min(360px, 90vw)', aspectRatio: '1', border: '3px solid var(--line-2)', borderRadius: '14px', overflow: 'hidden', boxShadow: 'var(--shadow)' } });
    
    st.board.forEach((piece, i) => {
      const row = Math.floor(i / 8), col = i % 8;
      const isDark = (row + col) % 2 === 1;
      const isSelected = selectedChessSquare === i;

      board.append(h('button', {
        style: {
          background: isSelected ? 'var(--rose-soft)' : isDark ? '#B4766B' : '#FAF6EE',
          fontSize: '1.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: isDark ? '#FFF' : '#1C1613'
        },
        onclick: () => {
          if (selectedChessSquare === null) {
            if (piece) { selectedChessSquare = i; draw(); }
          } else {
            if (selectedChessSquare === i) { selectedChessSquare = null; draw(); }
            else {
              const from = selectedChessSquare;
              selectedChessSquare = null;
              move({ from, to: i });
            }
          }
        }
      }, piece ? (SYMBOLS[piece] || piece) : ''));
    });

    stage.replaceChildren(board, h('p', { class: 'small muted' }, selectedChessSquare !== null ? 'Click target square to complete move' : 'Tap a piece to select'));
  }

  /* 2. CHECKERS */
  let selectedCheckerSquare = null;
  function renderCheckers(st) {
    const board = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', width: 'min(360px, 90vw)', aspectRatio: '1', border: '3px solid var(--line-2)', borderRadius: '14px', overflow: 'hidden', boxShadow: 'var(--shadow)' } });
    
    st.board.forEach((piece, i) => {
      const row = Math.floor(i / 8), col = i % 8;
      const isDark = (row + col) % 2 === 1;
      const isSelected = selectedCheckerSquare === i;
      const sym = piece === 'r' ? '🔴' : piece === 'rk' ? '👑🔴' : piece === 'b' ? '⚪' : piece === 'bk' ? '👑⚪' : '';

      board.append(h('button', {
        style: {
          background: isSelected ? 'var(--rose-soft)' : isDark ? '#7A8572' : '#FAF6EE',
          fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer'
        },
        onclick: () => {
          if (selectedCheckerSquare === null) {
            if (piece) { selectedCheckerSquare = i; draw(); }
          } else {
            if (selectedCheckerSquare === i) { selectedCheckerSquare = null; draw(); }
            else {
              const from = selectedCheckerSquare;
              selectedCheckerSquare = null;
              move({ from, to: i });
            }
          }
        }
      }, sym));
    });

    stage.replaceChildren(board, h('p', { class: 'small muted' }, selectedCheckerSquare !== null ? 'Click target square to move checker' : 'Tap a piece to select'));
  }

  /* 3. WORD GUESS / WORDLE */
  function renderWordle(st) {
    const guessesBox = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '360px' } });
    st.guesses.forEach(g => {
      const row = h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center' } });
      const sec = st.secret.split('');
      g.word.split('').forEach((ch, idx) => {
        let bg = 'var(--card-2)';
        if (ch === sec[idx]) bg = 'var(--ok)';
        else if (sec.includes(ch)) bg = 'var(--gold)';
        else bg = 'var(--line-2)';
        row.append(h('div', { style: { width: '42px', height: '42px', background: bg, color: '#fff', fontWeight: 'bold', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' } }, ch));
      });
      guessesBox.append(row);
    });

    const inp = h('input', { class: 'input', placeholder: '6-LETTER WORD', maxlength: '6', style: { width: '220px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.12em', fontSize: '1.2rem', fontWeight: 'bold' } });
    const sub = h('button', { class: 'btn btn-primary', onclick: () => { if (inp.value.length === 6) move({ guess: inp.value }); } }, 'Guess Word');

    stage.replaceChildren(guessesBox,
      st.solved ? endCard('🎉 Secret word unlocked! Word was: ' + st.secret) :
      st.guesses.length >= st.maxGuesses ? endCard('Wordle finished! Word was: ' + st.secret) :
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } }, inp, sub));
  }

  /* 4. COUPLE TRIVIA */
  function renderTrivia(st) {
    const q = st.qs[st.idx];
    if (!q) { stage.replaceChildren(endCard('🎉 Relationship Trivia Complete! Great connection!')); return; }
    const answered = st.answers?.[meId] !== undefined;

    const card = h('div', { class: 'card card-pad', style: { maxWidth: '460px', textAlign: 'center', width: '100%' } },
      h('span', { class: 'tag', style: { marginBottom: '12px', display: 'inline-block' } }, `Question ${st.idx + 1} of ${st.qs.length}`),
      h('h3', { class: 'serif', style: { fontSize: '1.3rem', marginBottom: '20px', lineHeight: 1.4 } }, q.q),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, q.options.map((opt, i) =>
        h('button', {
          class: 'btn ' + (st.answers?.[meId] === i ? 'btn-primary' : 'btn-subtle'),
          style: { padding: '12px 18px', textAlign: 'left', justifyContent: 'flex-start' },
          disabled: answered,
          onclick: () => move({ move: i })
        }, opt)
      ))
    );

    if (st.revealed) {
      card.append(h('button', { class: 'btn btn-primary', style: { marginTop: '18px', width: '100%' }, onclick: () => move({ action: 'next' }) }, 'Next Question ➔'));
    } else if (answered) {
      card.append(h('p', { class: 'small muted', style: { marginTop: '14px' } }, 'Answer locked in! Waiting for partner...'));
    }
    stage.replaceChildren(card);
  }

  /* 5. RPS SPOCK DUEL */
  function renderRPS(st) {
    const opts = [
      { id: 'rock', emoji: '✊', label: 'Rock' },
      { id: 'paper', emoji: '✋', label: 'Paper' },
      { id: 'scissors', emoji: '✌️', label: 'Scissors' },
      { id: 'spock', emoji: '🖖', label: 'Spock' }
    ];
    const myChoice = st.choices?.[meId];
    const card = h('div', { class: 'card card-pad', style: { textAlign: 'center', maxWidth: '420px', width: '100%' } },
      h('h3', { class: 'serif', style: { fontSize: '1.4rem', marginBottom: '16px' } }, `Round ${st.round || 1}`),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, opts.map(o =>
        h('button', {
          class: 'btn ' + (myChoice === o.id ? 'btn-primary' : 'btn-subtle'),
          style: { fontSize: '1.1rem', padding: '14px' },
          disabled: !!myChoice,
          onclick: () => move({ move: o.id })
        }, o.emoji + ' ' + o.label)
      ))
    );

    if (st.revealed) {
      card.append(
        h('div', { class: 'card card-pad', style: { marginTop: '16px', background: 'var(--paper-2)' } },
          h('p', { class: 'serif', style: { fontSize: '1.2rem', marginBottom: '10px' } }, 'Choices Revealed!'),
          h('button', { class: 'btn btn-primary', onclick: () => move({ action: 'next' }) }, 'Next Round ➔')
        )
      );
    } else if (myChoice) {
      card.append(h('p', { class: 'small muted', style: { marginTop: '14px' } }, 'Choice locked! Waiting for partner...'));
    }
    stage.replaceChildren(card);
  }

  /* 6. TIC TAC TOE */
  function renderTTT(st) {
    const done = st.winner !== undefined && st.winner !== null;
    const grid = h('div', { class: 'ttt-board' });
    st.board.forEach((cell, i) => {
      grid.append(h('button', {
        class: 'ttt-cell' + (cell === meId ? ' x' : cell ? ' o' : ''),
        disabled: !!cell || done || (session.turn && session.turn !== meId),
        onclick: () => move({ move: i }),
      }, cell ? (cell === meId ? '✕' : '◯') : ''));
    });

    const scores = st.history || {};
    stage.replaceChildren(grid,
      h('div', { class: 'chip' }, `Series Score: You ${scores[meId] || 0} — ${scores[partnerUser?.userId || 'partner'] || 0} ${partnerName}`),
      done ? endCard(st.winner === 'draw' ? 'Draw game!' : st.winner === meId ? 'You win this round! 🎉' : `${partnerName} wins!`) : '');
  }

  /* 7. CONNECT FOUR */
  function renderC4(st) {
    const done = st.winner && st.winner !== null;
    const drops = h('div', { class: 'c4-drop' }, [0, 1, 2, 3, 4, 5, 6].map(c =>
      h('button', { disabled: done || (session.turn && session.turn !== meId), onclick: () => move({ move: c }) }, '↓')));
    const board = h('div', { class: 'c4-board' });
    st.board.forEach((cell) => {
      board.append(h('div', { class: 'c4-cell' + (cell ? (cell === meId ? ' a' : ' b') : '') }));
    });
    stage.replaceChildren(drops, board,
      done ? endCard(st.winner === 'draw' ? 'Full board draw!' : st.winner === meId ? 'Four in a row — You Win! 🎉' : `${partnerName} connects four!`) : '');
  }

  /* 8. MEMORY MATCH */
  function renderMemory(st) {
    const grid = h('div', { class: 'mem-grid' });
    st.deck.forEach(card => {
      const matched = st.matched.includes(card.g);
      const revealed = st.revealed.includes(card.i);
      grid.append(h('button', {
        class: 'mem-card' + (revealed || matched ? ' flip' : '') + (matched ? ' matched' : ''),
        disabled: matched || revealed || (st.turn && st.turn !== meId),
        onclick: () => move({ move: card.i }),
      },
        h('span', { class: 'back' }, '✦'),
        h('span', { class: 'front' }, card.g)));
    });
    const s = st.scores || {};
    stage.replaceChildren(grid,
      h('div', { class: 'chip' }, `Pairs Matched: You ${s[meId] || 0} — ${s[partnerUser?.userId || 'partner'] || 0} ${partnerName}`),
      st.winner ? endCard('All pairs uncovered!') : '');
  }

  /* 9 & 10. WOULD YOU RATHER & THIS OR THAT */
  function renderDuel(st) {
    const q = st.qs[st.idx];
    if (!q) { stage.replaceChildren(endCard('You completed the deck! ❤️')); return; }
    const myAnswer = st.answers?.[meId];
    const choices = q.options || [q.text];

    const box = h('div', { class: 'card card-pad', style: { maxWidth: '480px', width: '100%', textAlign: 'center' } },
      h('span', { class: 'eyebrow' }, `Card ${st.idx + 1} of ${st.qs.length}`),
      h('h3', { class: 'serif', style: { fontSize: '1.35rem', margin: '14px 0 20px', lineHeight: 1.4 } }, q.options ? `${q.options[0]} — or — ${q.options[1]}` : q.text)
    );

    if (q.options) {
      box.append(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, q.options.map((o, i) =>
        h('button', {
          class: 'btn ' + (myAnswer === i ? 'btn-primary' : 'btn-subtle'),
          style: { padding: '14px', fontSize: '1.05rem' },
          disabled: myAnswer !== undefined,
          onclick: () => move({ move: i })
        }, o)
      )));
    } else {
      const inp = h('input', { class: 'input', placeholder: 'Your answer...', disabled: myAnswer !== undefined, style: { marginBottom: '10px' } });
      const sub = h('button', { class: 'btn btn-primary', disabled: myAnswer !== undefined, onclick: () => { if (inp.value.trim()) move({ move: inp.value.trim() }); } }, 'Submit Answer');
      box.append(inp, sub);
    }

    if (st.revealed) {
      box.append(h('button', { class: 'btn btn-primary', style: { marginTop: '16px', width: '100%' }, onclick: () => move({ action: 'next' }) }, 'Next Card ➔'));
    }
    stage.replaceChildren(box);
  }

  /* 11. DRAWING GAME */
  function renderDraw(st) {
    const W = 640, H = 400;
    const canvas = h('canvas', { width: W, height: H, style: { display: 'block', width: '100%', background: '#FAF6EE', borderRadius: '16px', border: '2px solid var(--line-2)', touchAction: 'none' } });
    const ctx = canvas.getContext('2d');
    const colors = ['#1C1613', '#C87D70', '#C89B54', '#7A8572', '#5E222B'];
    let color = colors[0];

    const prompt = h('div', { class: 'card card-pad', style: { padding: '12px 20px', marginBottom: '10px' } },
      h('span', { class: 'eyebrow' }, 'Shared Prompt'),
      h('h3', { class: 'serif', style: { fontSize: '1.2rem' } }, st.prompt || 'Draw a romantic scene together!'));

    const tools = h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' } },
      colors.map(c => h('button', {
        style: { width: '28px', height: '28px', borderRadius: '50%', background: c, border: c === color ? '3px solid var(--ink)' : 'none', cursor: 'pointer' },
        onclick: () => { color = c; }
      })),
      h('button', { class: 'btn btn-subtle btn-sm', onclick: () => move({ action: 'clear' }) }, 'Clear Canvas'),
      h('button', { class: 'btn btn-primary btn-sm', onclick: () => move({ action: 'next' }) }, 'Next Prompt ➔')
    );

    function paint() {
      ctx.fillStyle = '#FAF6EE'; ctx.fillRect(0, 0, W, H);
      for (const s of (st.strokes || [])) {
        ctx.strokeStyle = s.color; ctx.lineWidth = s.size || 4; ctx.lineCap = 'round';
        ctx.beginPath();
        s.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();
      }
    }
    paint();

    let drawing = false, pts = [];
    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return [Math.round((p.clientX - r.left) / r.width * W), Math.round((p.clientY - r.top) / r.height * H)];
    };
    const startDraw = (e) => { e.preventDefault(); drawing = true; pts = [getPos(e)]; };
    const moveDraw = (e) => { if (!drawing) return; e.preventDefault(); pts.push(getPos(e)); paint(); };
    const stopDraw = () => { if (!drawing) return; drawing = false; move({ action: 'stroke', stroke: pts, color }); };

    canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', moveDraw); addEventListener('mouseup', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false }); canvas.addEventListener('touchmove', moveDraw, { passive: false }); canvas.addEventListener('touchend', stopDraw);

    stage.replaceChildren(prompt, canvas, tools);
  }

  function endCard(msg) {
    return h('div', { class: 'card card-pad', style: { textAlign: 'center', padding: '24px' } }, h('h3', { class: 'serif', style: { fontSize: '1.3rem' } }, msg));
  }

  offs.push(on('game:state', (m) => {
    if (!session || m.session.id !== session.id) return;
    session = m.session;
    draw();
  }));

  start();
  return { destroy() { offs.forEach(off => off()); } };
}

/* Local Session Builder for Instant Play */
function buildLocalSession(game, p1, p2) {
  let state = {};
  if (game === 'chess') {
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
  } else if (game === 'checkers') {
    const board = Array(64).fill(null);
    [1,3,5,7,8,10,12,14,17,19,21,23].forEach(i => board[i] = 'b');
    [40,42,44,46,49,51,53,55,56,58,60,62].forEach(i => board[i] = 'r');
    state = { board };
  } else if (game === 'wordle') {
    state = { secret: 'ROMANCE', guesses: [], maxGuesses: 6, solved: false };
  } else if (game === 'trivia') {
    state = {
      qs: [
        { q: "Where was your very first date or meeting?", options: ["Café / Coffee", "Park / Walk", "Movie / Dinner", "Online / Video Call"] },
        { q: "What's your favorite way to spend a quiet Sunday together?", options: ["Cooking & Movie", "Gaming together", "Stargazing & Long talks", "Music & Dancing"] }
      ],
      idx: 0, answers: {}
    };
  } else if (game === 'rps') {
    state = { choices: {}, round: 1 };
  } else if (game === 'ttt') {
    state = { board: Array(9).fill(null), history: { [p1]: 0, [p2]: 0 } };
  } else if (game === 'c4') {
    state = { board: Array(42).fill(null) };
  } else if (game === 'memory') {
    const EMOJIS = ['❤️', '☕', '🌙', '💐', '🕯️', '✈️', '📸', '🎵'];
    const deck = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5).map((g, i) => ({ i, g }));
    state = { deck, revealed: [], matched: [], scores: { [p1]: 0, [p2]: 0 } };
  } else if (game === 'wyr' || game === 'thisthat') {
    state = {
      qs: [
        { options: ['Spontaneous road trip', 'Planned luxury resort stay'] },
        { options: ['Late night deep talks', 'Early morning coffee dates'] }
      ],
      idx: 0, answers: {}, revealed: false
    };
  } else if (game === 'draw') {
    state = { prompt: 'A warm cabin in the snow with two glowing lamps', strokes: [] };
  }

  return { id: 'local_' + Date.now(), game, turn: p1, state };
}

function applyLocalMove(session, meId, payload) {
  const st = session.state;
  const game = session.game;

  if (game === 'chess') {
    if (payload.from !== undefined && payload.to !== undefined) {
      st.board[payload.to] = st.board[payload.from];
      st.board[payload.from] = null;
    }
  } else if (game === 'checkers') {
    if (payload.from !== undefined && payload.to !== undefined) {
      st.board[payload.to] = st.board[payload.from];
      st.board[payload.from] = null;
    }
  } else if (game === 'wordle') {
    if (payload.guess && payload.guess.length === 6) {
      st.guesses.push({ word: payload.guess.toUpperCase(), by: meId });
      if (payload.guess.toUpperCase() === st.secret) st.solved = true;
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
      st.choices = {}; st.revealed = false; st.round = (st.round || 1) + 1;
    } else {
      st.choices[meId] = payload.move;
      st.choices['partner'] = ['rock','paper','scissors','spock'][Math.floor(Math.random() * 4)];
      st.revealed = true;
    }
  } else if (game === 'ttt') {
    if (st.board[payload.move] === null) {
      st.board[payload.move] = meId;
      const checkWin = (b) => {
        const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for (const [x,y,z] of lines) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
        return b.every(c => c !== null) ? 'draw' : null;
      };
      const w = checkWin(st.board);
      if (w) st.winner = w;
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
      st.revealed = true;
    }
  } else if (game === 'draw') {
    if (payload.action === 'stroke') {
      st.strokes.push({ color: payload.color || '#1C1613', pts: payload.stroke });
    } else if (payload.action === 'clear') st.strokes = [];
    else if (payload.action === 'next') { st.strokes = []; }
  }
}
