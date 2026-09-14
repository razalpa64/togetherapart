# Running Together, Apart on Supabase — the whole walkthrough

This app can run two ways, and both ship in this repo:

| | **Self-hosted** (default) | **Supabase** (this guide) |
|---|---|---|
| Server | the Node server in `server/` | none — just static files |
| Data | JSON files in `data/` on that machine | Postgres + Storage in your Supabase project |
| Accounts | built-in, stored locally | Supabase Auth (email + password, optional Google) |
| Realtime | the server's WebSocket | Supabase Realtime channels |
| Best for | total privacy, one machine, zero cloud | a real URL both of you can open from anywhere |

Switching is one file: `public/env.js`. Empty values = self-hosted. Filled values = Supabase. Nothing else changes — same features, same screens.

Everything below is every step, in order. Budget ~20 minutes.

---

## 0. What you need

- A Supabase account (free tier is plenty): sign up at **https://supabase.com** with GitHub or email.
- Node.js 18+ installed (only needed to run the demo seeder or the local static server — not for the app itself).
- This folder (the app) — you'll deploy its `public/` directory at the end.

---

## 1. Create the project

1. Go to **https://supabase.com/dashboard** and click **New project**.
2. Pick an organization (create one if it's your first time — the free "Personal" one is fine).
3. Name it anything — `together-apart` works.
4. Generate/set a **database password**. Save it somewhere safe (a password manager). You won't need it for day-to-day use, but you need it for project settings.
5. Pick the region **closest to the two of you** (latency = how snappy chat and the room feel). For India, choose **Mumbai (ap-south-1)**.
6. Click **Create new project** and wait ~2 minutes while it provisions.

---

## 2. Load the database schema

The entire database — 16 tables, security policies, triggers, the game engines, the surprise-seal logic, the storage bucket — is one file: **`supabase/schema.sql`** in this repo.

1. In your project's dashboard, open **SQL Editor** (icon with the database terminal, left sidebar).
2. Click **New query** (or the `+`).
3. Open `supabase/schema.sql` from this repo in any text editor, **select all**, copy.
4. Paste it into the SQL editor. It's long (~900 lines) — that's expected.
5. Click **Run** (bottom right) and wait for `Success. No rows returned`.

What it just created:
- Tables: `profiles`, `couples`, `members`, `messages`, `reactions`, `reads`, `memories`, `milestones`, `places`, `songs`, `countdowns`, `surprises`, `dates`, `game_sessions`, `notifications`, `notif_prefs`
- **Row Level Security on everything** — the database itself refuses to show one couple's data to another, even if someone crafts requests by hand.
- The **surprise seal**: a security policy (not app code) guarantees a surprise's payload physically cannot leave the database before its unlock time, even for the person it's addressed to.
- **Server-authoritative games**: tic-tac-toe, connect four, memory, would-you-rather, this-or-that and the shared canvas run as database functions (`game_start` / `game_move` / `game_reset`) — nobody can fake a win from the browser.
- A private **storage bucket** named `media` where photos/voice notes go, scoped so only your couple can read them.
- **Realtime publication** for all the shared tables, plus notification triggers (partner "left you a surprise", "saved a memory", etc.).

**Verify it worked** — in SQL Editor, run a new query:

```sql
select tablename from pg_tables where schemaname = 'public' order by tablename;
```

You should see 16 rows (plus `schema_migrations` is fine too, ignore it). And:

```sql
select count(*) from pg_policies where schemaname = 'public';
```

should return **24** or more.

---

## 3. Auth settings

Open **Authentication → Sign In / Providers** (or **Authentication → Providers** on older dashboards):

### 3a. Email (the default — works out of the box)

- **Enable email provider**: on (it is by default).
- **Confirm email**: for a private two-person world, we recommend **turning it off**. With it off, sign-up logs you straight in. If you leave it on, the app still works — it just tells new users to check their inbox first.
  - Path: **Authentication → Sign In / Providers → Email → Confirm email** → toggle.
- The app enforces its own minimum of 8 characters in the UI; Supabase's server-side minimum (6) is a backstop.

### 3b. Password reset emails (set this after you know your URL)

The "Forgot password?" flow emails a reset link:

1. **Authentication → URL Configuration**.
2. **Site URL**: your final app URL (`http://localhost:4020` while testing, your real domain after deploying — see §7).
3. **Redirect URLs**: add both `http://localhost:4020/app/**` and `https://your-domain/app/**` (and any preview URLs you'll use).

### 3c. Optional: Google sign-in

Only if you want the "Continue with Google" button:

1. Create OAuth credentials at **https://console.cloud.google.com** (OAuth consent screen + OAuth client ID, type *Web application*). Google will ask for an *Authorized redirect URI* — Supabase shows you the exact value to paste in **Authentication → Providers → Google** once you enable it (`https://<project-ref>.supabase.co/auth/v1/callback`).
2. In Supabase: **Authentication → Providers → Google → Enable**, paste the Client ID and Client Secret.
3. Add your deployed URL to the Redirect URLs (§3b).

If you skip this, the app simply doesn't show the Google button. Nothing breaks.

### 3d. A note on built-in emails

Supabase's built-in email sender is rate-limited (a few per hour on the free plan). For a two-person world this is almost always fine, because with "Confirm email" off, emails only ever get sent for password resets. If you ever hit limits, you can plug a custom SMTP (Settings → Auth → SMTP) or a transactional provider — not needed to start.

---

## 4. Connect the app

1. In the dashboard, go to **Project Settings → API** (gear icon → API; on the newest dashboards it's **Settings → API Keys**).
2. Copy two values:
   - **Project URL** — looks like `https://abcd1234.supabase.co`
   - **The public key** — on newer projects that's the **`publishable` key** (starts with `sb_publishable_...`); on older projects it's the **`anon` `public`** key (a long `eyJhbGciOi...` string). Both go in the same slot below, and both are designed to be public.
3. Open **`public/env.js`** in this repo and paste them in:

```js
window.__TA_ENV__ = {
  supabaseUrl: 'https://abcd1234.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
};
```

Save. That's the entire integration step.

> **Is pasting that key into a public file safe?** Yes — the public key (anon / publishable) is *designed* to be public. It only grants access the database's Row Level Security policies allow, and those policies (from `schema.sql`) only ever allow: your own account, and your own couple's rows. Never paste the **secret key** (`sb_secret_...`, or `service_role` on older projects) anywhere in this app — that one bypasses all security and is only used by the optional demo seeder (§5) from your own machine.

> **URL config**: while you're in **Authentication → URL Configuration**, set the **Site URL** to where the app will actually live (see §7), and add `http://localhost:4020/app/**` to Redirect URLs for local testing.

---

## 5. Run it

### 5a. Locally (try it right now)

From this folder:

```bash
node scripts/serve-static.mjs
```

then open **http://localhost:4020**. You should see the landing page; click through to the app, create your account, make your world.

Any other static file server works too (e.g. `npx serve public`), as long as `/app` serves `app.html` (the script above handles that rewrite).

> Note: the Node app server (`npm start`) also still works with env.js filled — it just serves the files; the app itself talks to Supabase directly.

### 5b. Invite your partner

1. You sign up, create your world — the app shows you an **invite code** (looks like `LUNA-4827`).
2. They open the same URL, choose **Create your world →** actually they pick "New here? Create your world", make their own account, then enter your code at the join step (or just open your invite link).
3. That's it — you're both in. The code is single-use-ish: joining is one-shot, and a world holds exactly two people.

### 5c. Optional: the demo world

The "Enter demo world" button on the sign-in screen needs demo data in your project. Seed it from your own machine (never deploy this key):

```bash
node scripts/seed-demo.mjs --url https://abcd1234.supabase.co --key YOUR_SERVICE_ROLE_KEY
```

(Get the key from Project Settings → API: `service_role` on older projects, or the **secret key** `sb_secret_...` on newer ones. Tip: put it in a `.env` file — `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — and `npm run seed:demo` picks it up automatically.)

This creates a clearly-labeled demo couple (Aisha & Ravi — full chat history, memories, songs, a sealed surprise, a finished date) and uploads the demo photos into your `media` bucket. Sign in as `aisha@demo.togetherapart.app` / `demo-world-123` or just press the demo button. Re-run with `--force` to reset it.

---

## 6. Use it

Everything works the same as the self-hosted version:

- **Our Place** — the shared room. Lamp, candles, string lights, music, ambience, sitting together, moods, countdowns, the wall frames showing pinned memories. Partner's dot glows when they're online (Realtime presence).
- **Chat** — text, photos, voice notes, replies, reactions, read receipts, search.
- **Date Night** — plan a date by mood/energy/time or take the surprise roll; run it step-by-step together in sync.
- **Activities** — question decks (cards/deep/future/childhood), games (tic-tac-toe, connect four, memory match, would-you-rather, this-or-that, draw together).
- **Memories, Our Story, Places, Songs, Surprises, Photo Booth, Premium** — all live.
- **Surprises are sealed by the database**: until the unlock time, the payload is not readable by anyone — including the recipient and anyone with the anon key. The moment it unlocks, the recipient gets a notification.

The **password-reset** flow: sign-in screen → "Forgot password?" → email link → opens the app straight into a "choose a new password" screen.

---

## 7. Deploy (give it a real URL)

You're deploying **static files only** — the `public/` folder. Pick any:

### Vercel (recommended)

1. Push this folder to a GitHub repo (the `.gitignore` keeps `data/` and secrets out; `public/env.js` with the anon key is meant to be public, see §4).
2. On **https://vercel.com** → **Add New → Project** → import the repo.
3. Framework preset: **Other**. Everything else default. The included `vercel.json` handles `/app` → `app.html` and caching.
4. Deploy. You'll get `https://your-app.vercel.app`.
5. Back in Supabase → **Authentication → URL Configuration**: set **Site URL** to `https://your-app.vercel.app` and add `https://your-app.vercel.app/app/**` to Redirect URLs. (Forgot-password and Google links break without this step.)

### Netlify

1. Drag-and-drop the `public/` folder onto https://app.netlify.com/drop — done. (`public/_redirects` handles `/app`.)
2. Or connect the repo; build command: none, publish directory: `public`.
3. Same Supabase URL Configuration step as above.

### Any static host / your own server

Upload `public/` and make sure `/app` serves `app.html` and `/` serves `index.html`. If you already run the Node server somewhere, that works as-is too.

---

## 8. Day-to-day & care

- **Where your data lives**: Supabase Postgres (tables above) + Storage (`media` bucket, private). You can browse it all in the dashboard (Table Editor, Storage) — that's your admin view.
- **Backups**: free tier doesn't include automatic backups — but you can export anytime: dashboard → **Database → Backups** won't help on free; instead use SQL Editor `pg_dump` via CLI, or simply: Project Settings → Database → Connection string, and `pg_dump` from your machine. For a two-person app, doing this once a month is plenty:
  ```bash
  pg_dump "postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres" -Fc -f backup.dump
  ```
- **Free tier limits** you'd realistically care about: 500 MB database (this app uses kilobytes per month), 1 GB storage (photos are compressed client-side before upload), 50k monthly active users (you are 2), realtime included. Free projects may be **paused** after a long period of total inactivity — if that happens, the dashboard shows a big Restore button and everything comes back.
- **Deleting / starting over**: dashboard → Settings → General → Delete project. Or to reset just the app data while keeping the project: SQL Editor → `truncate public.couples restart identity cascade;` (keeps accounts), or delete users under Authentication → Users.
- **Switching back to self-hosted**: blank out `public/env.js` and run `npm start`. The two modes never share data.

---

## 9. Troubleshooting

| What you see | What it means / fix |
|---|---|
| "We couldn't reach your world" on sign-in | `env.js` values wrong, or project paused (§8). Check the URL loads in a browser and the key is the **anon** one. |
| `new row violates row-level security policy` toast | You're signed out or your account isn't in a world — refresh and sign in. If it persists, schema.sql didn't fully run — re-run §2. |
| Sign-up says "check your inbox" | "Confirm email" is ON (§3a). Either turn it off or go confirm, then sign in. |
| Reset email never arrives | Built-in sender is rate-limited (§3d) — wait a few minutes; check spam. Redirect URLs must include your origin (§3b). |
| Google button says provider not enabled | Do §3c, or ignore the button — email login always works. |
| Realtime stuff is quiet (partner's dot never lights) | You're on different couples' pages, or the project is paused. Both tabs must be signed-in members of the same world. |
| Photos fail to upload | Storage bucket `media` missing → re-run schema.sql §2. File over ~25 MB will fail; the app compresses before upload anyway. |
| Demo button says not set up | Run the seeder (§5c). |
| `relation "storage.buckets" does not exist` when running schema.sql | You pasted it into the wrong place — it must run in the **Supabase SQL Editor** (or as `postgres`), where the `storage` schema exists. |

---

## 10. What's where in this repo

| File | What it is |
|---|---|
| `supabase/schema.sql` | The entire database migration. Run it once (§2). |
| `public/env.js` | The mode switch — self-hosted (empty) vs Supabase (URL + publishable/anon key). |
| `public/vendor/supabase.js` | Self-contained `@supabase/supabase-js` v2 bundle (no CDN needed — works offline/air-gapped). |
| `public/js/backend/supabase.js` | The Supabase backend: implements every app operation (auth, tables, RPCs, realtime, signed media URLs) behind the same interface the app already used. |
| `public/js/content/decks.js`, `public/js/content/planner.js` | Question decks and the date planner, as used client-side in Supabase mode. |
| `scripts/seed-demo.mjs` | Demo world seeder (service key, run locally). |
| `scripts/serve-static.mjs` | Tiny static server for local Supabase-mode testing. |
| `scripts/test-supabase-local.sh` + `test/supabase-*.sql` | 36 behavioral tests for the schema on a throwaway local Postgres 17 — RLS isolation, the surprise seal, all five games, triggers. What validated this schema before it ever touched your project. |
| `test/supabase-client-smoke.sh` | 22 wiring tests for the client backend itself (route table, mappers, validation, realtime lifecycle) against a mocked supabase-js. |
| `server/` | The self-hosted Node server (the other mode). Untouched by Supabase setup. |

---

## Quick recap (TL;DR)

1. New project at supabase.com → **Mumbai region**.
2. SQL Editor → paste **`supabase/schema.sql`** → Run.
3. Settings → API → copy **Project URL** + **publishable key** (or anon public key) into **`public/env.js`**.
4. (Recommended) Authentication → Providers → Email → **Confirm email off**.
5. `node scripts/serve-static.mjs` → http://localhost:4020 — make accounts, share the invite code.
6. (Optional) `node scripts/seed-demo.mjs --url … --key …` for the demo world.
7. Deploy `public/` to Vercel/Netlify → set that URL in Authentication → URL Configuration.

That's all of it. Enjoy your world. 🕯️
