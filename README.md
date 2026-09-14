# Together, Apart

**Your place, wherever you are.**

A private digital world for long-distance couples — a shared room you both live in,
date nights, sealed surprises, memories, games, and *Just Stay*: quiet presence when
conversation isn't the point. Not another video-calling app. A place that belongs to two people.

---

## Run it

```bash
node server/index.js        # or: npm start
# → http://localhost:3000
```

Zero dependencies — Node 18+ only. Everything (static files, REST API, WebSocket realtime,
WebRTC signaling, ambient audio synthesis) runs from this one process.

```bash
node test/ws-test.mjs       # 41-check end-to-end test (expects server on :3000)
```

### Run it on Supabase instead (no server at all)

The same app can run entirely on [Supabase](https://supabase.com) — Postgres, Auth,
Storage and Realtime — with zero backend to host. One file switches modes:

1. Create a project, run **`supabase/schema.sql`** in its SQL editor
   (16 tables, RLS on everything, server-authoritative games, the surprise seal,
   the private `media` bucket, realtime publication — all in one paste).
2. Paste your Project URL + anon key into **`public/env.js`**.
3. `node scripts/serve-static.mjs` → http://localhost:4020 — or deploy `public/`
   to any static host (Vercel/Netlify configs included).

**Every step, click by click: [`SETUP-SUPABASE.md`](SETUP-SUPABASE.md).**
The schema is verified by 36 behavioral tests (`npm run test:supabase`, runs a
throwaway local Postgres 17), the client backend by 22 more (`npm run
test:supabase-client`), and the self-hosted mode above is untouched (41/41
end-to-end).

### Try it with two people (or two tabs)

1. **Create your world** — sign up, give your name and your partner's, get a code like `VESPER-2565`.
2. Send the code/link to your partner — they sign up and enter it.
3. You're together now. Open two browser tabs to watch everything sync live.

### Demo world (no partner needed)

On the sign-in screen: **"Enter demo world"** — a fully seeded couple (Aisha & Ravi) with messages,
memories, milestones, places, songs, countdowns, a sealed surprise and a finished date.
It is clearly labeled as sample data everywhere, and **"View as the other partner"** switches sides
so you can test realtime sync alone. Real accounts never see or touch demo data.

---

## The experience

| | |
|---|---|
| **Our Place** | A hand-drawn interactive living room (SVG): sofa, window with weather, lamp, candle, tea, record player, bookshelf, photo frames (they show your pinned memories), a sleeping cat. Both partners' avatars sit in it, live. Move seats, wave, hug, hold hands, send hearts. |
| **Just Stay** | The quiet mode: full-screen environments (rain, balcony, beach, café, cozy apartment + premium cabin & rooftop), synthesized ambience, hold-hands, send a hug, optional voice/video. "They don't need anything. They just want you here." |
| **Date Night** | Pick mood, time and energy → the planner composes a full timeline (arrive, songs for each other, conversation cards, a game, a photo, the sunset, gratitude). Start it and both of you walk the same steps, live. Skip anything. Keep everything. |
| **Activities** | Conversation decks (cards, deep, future, childhood), Would You Rather & This or That (answer-then-reveal duels), Tic Tac Toe, Connect Four, Memory Match, a shared Drawing canvas — all server-authoritative and synced. Watch-together and listen-together rituals with a 3-2-1 synced start. |
| **Chat** | Text, photos, voice notes, emoji reactions, replies, read receipts, typing indicator, search, save-to-memories. |
| **Memories & Our Story** | A month-grouped memory timeline (photos, notes, voice, songs, dates, milestones) and a milestone story line. Pinned photos appear on the room's wall. |
| **Places We'll Go** | Shared bucket list with generated cover art, status *dreaming → planned → visited*, checklists, countdowns. |
| **Our Songs** | The soundtrack: rank, favorite, crown a song of the month, play-together sync ritual, attach songs to memories. |
| **Surprises** | Letters, gifts, date invitations, memory collections — sealed on the server until their unlock moment (it refuses to hand them over early). |
| **Moods** | Silent emotional state with gentle partner actions (send hug, leave a note, play our song, join them). |
| **Countdowns** | "42 days until we see each other." Emotionally typeset, not widgets. |
| **Photo Booth** | Avatar or camera, environments, frames, captions, date stamps — saved straight to Memories. |
| **Premium** | Quiet and honest: the free world is whole; premium adds the cabin & rooftop scenes and memory surprises. A demo switch lets you try it (in production: one subscription per couple). |

---

## Architecture

```
server/                       zero-dependency Node 18+
  index.js                    HTTP + static + WebSocket upgrade + boot
  lib/
    db.js                     JSON document store, atomic writes (data/app.json)
    ws.js                     RFC6455 WebSocket server (handshake, frames, ping/pong)
    realtime.js               hub: per-couple channels, presence, WebRTC relay
    auth.js                   scrypt passwords, sessions, reset tokens
    events.js                 notifications + entity broadcast helpers
    util.js                   ids, validation, rate limiting, body parsing
  routes/                     auth, couple, chat, content, dates, games, surprises, misc
  content/                    decks (questions), planner (date composer), demo seed

public/                       no build step — native ES modules
  index.html                  landing page (scroll storytelling)
  app.html                    app shell
  css/                        base (design system), app, room, landing, self-hosted fonts
  js/
    app.js                    boot, shell, router, realtime wiring
    state.js · api.js · ws.js · bus.js
    ui.js                     DOM helper, icons, avatars, modals, sheets, toasts
    room-scene.js             the living room SVG scene
    stay.js                   Just Stay overlay + hand-crafted SVG environments
    audio.js                  WebAudio ambience synthesis (rain, fire, ocean, café, night, wind)
    rtc.js                    WebRTC voice/video, signaled over the same socket
    games/index.js            all game engines (client)
    views/                    one module per view, lazy-imported by the router
```

### Realtime model

One WebSocket per tab (`/ws?token=…`). Writes go through REST; the server broadcasts
every change to the couple's channel (`chat:message`, `presence`, `avatar:move`, `room:patch`,
`game:state`, `date:event`, `mood`, `notify`, `entity`…). Ephemeral gestures (typing, waves,
floats, holding hands, WebRTC signaling) travel the socket directly. Presence tracks
online / away / busy / watching / playing / listening / just staying, with reconnect grace
and auto-away on idle.

### Data model

`users · sessions · couples · members · messages · reactions · reads · memories · milestones ·
places · songs · countdowns · surprises · dates · games · moods · notifications · media`
— every query is couple-scoped and membership-checked.

### Privacy & security

- Passwords: scrypt + per-user salt. Sessions: 32-byte tokens, stored hashed.
- Every couple-scoped request verifies membership; media is served through an
  authorized endpoint, never a public folder.
- Surprises: payload withheld server-side until unlock time (tested).
- Rate limiting on auth, messages and uploads; input caps everywhere; DOM built
  with `textContent` (no HTML injection of user data).
- No public profiles, nothing searchable, no third-party requests — fonts are self-hosted.

### Going to production

Already done for Supabase — see [`SETUP-SUPABASE.md`](SETUP-SUPABASE.md). The schema
ships with RLS on every table, a database-enforced surprise seal, RPC-only game writes,
a private couple-scoped storage bucket, and realtime publications. The frontend keeps a
single interface (`public/js/api.js` + `ws.js`) with two interchangeable providers:
the Node server (default) and `public/js/backend/supabase.js`.

For the self-hosted path, the seams are deliberate:

- `lib/db.js` → swap for Postgres/SQLite (the route layer only uses `one/byId/T/save`).
- Add an email provider in `routes/auth.js` (reset currently returns the link — demo).
- Serve behind TLS, set `Secure` cookies if you switch to cookie sessions (this build
  uses Bearer tokens in `localStorage` + `Authorization`, which survives embedded previews).
- Add object storage for `data/media` (currently local files, capped at 8 MB).

---

*Built for two. Your world stays private — always.*
# togetherapart
