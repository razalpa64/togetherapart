-- ════════════════════════════════════════════════════════════════════════
-- TOGETHER, APART — Supabase schema
-- Run this once in the Supabase SQL Editor (or via `supabase db push`).
--
-- What it creates:
--   • 16 tables with Row Level Security — a couple's data is only ever
--     visible to the two of them (sealed surprises are enforced by RLS:
--     the payload is unreadable, by anyone, until its moment).
--   • RPC functions: world creation/joining, the /me snapshot, and
--     server-authoritative game engines (tic-tac-toe, connect four,
--     memory match, duels, drawing) so game rules can't be cheated.
--   • Triggers: profile creation, partner notifications.
--   • A private storage bucket "media" with couple-scoped policies.
--   • Realtime publication entries for live sync.
-- ════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- 1. TABLES
-- ───────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  name        text not null default 'Someone',
  avatar_path text,
  tz          text,
  created_at  timestamptz not null default now()
);

create table if not exists public.couples (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Us',
  invite_code text unique not null,
  anniversary date,
  theme       text not null default 'evening',
  plan        text not null default 'free',
  room        jsonb  not null default '{"scene":"living","window":"auto","lamp":true,"stringLights":true,"candle":true,"tea":true,"music":null,"volume":0.5}',
  demo        boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  couple_id      uuid not null references public.couples (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  display_name   text,
  accent         text not null default 'rose',
  hair           text not null default 'short',
  mood           text,
  mood_updated_at timestamptz,
  joined_at      timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  sender     uuid not null,
  type       text not null default 'text',
  body       text not null default '',
  media_path text,
  reply_to   uuid,
  deleted    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null,
  emoji      text not null,
  primary key (message_id, user_id)
);

create table if not exists public.reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.memories (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  author      uuid not null,
  type        text not null default 'note',
  title       text not null default 'A memory',
  body        text not null default '',
  media_path  text,
  happened_on date not null default current_date,
  song_title  text,
  song_artist text,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.milestones (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  date       date not null default current_date,
  title      text not null default 'A moment',
  note       text not null default '',
  icon       text not null default '❤️',
  created_at timestamptz not null default now()
);

create table if not exists public.places (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  name       text not null default 'Somewhere',
  country    text not null default '',
  image_path text,
  status     text not null default 'dreaming',
  note       text not null default '',
  dream_date text not null default '',
  target_on  date,
  checklist  jsonb not null default '[]',
  visited_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  title      text not null default 'Untitled',
  artist     text not null default '',
  link       text,
  note       text not null default '',
  added_by   uuid not null,
  favorite   boolean not null default false,
  month      boolean not null default false,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.countdowns (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  label      text not null default 'until we meet again',
  target_at  timestamptz not null,
  icon       text not null default '✈️',
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.surprises (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples (id) on delete cascade,
  from_user   uuid not null,
  to_user     uuid not null,
  type        text not null default 'letter',
  payload     jsonb not null default '{}',
  unlock_at   timestamptz not null,
  opened_at   timestamptz,
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.dates (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples (id) on delete cascade,
  mood         text not null default 'chill',
  duration     int  not null default 45,
  plan         jsonb not null default '{}',
  status       text not null default 'saved',
  current_step int  not null default -1,
  started_at   timestamptz,
  ended_at     timestamptz,
  created_by   uuid not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.game_sessions (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples (id) on delete cascade,
  game       text not null,
  state      jsonb not null default '{}',
  turn       uuid,
  status     text not null default 'active',
  winner     uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  type       text not null default 'presence',
  body       text not null default '',
  data       jsonb not null default '{}',
  silent     boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notif_prefs (
  user_id   uuid primary key references public.profiles (id) on delete cascade,
  messages  boolean not null default true,
  surprises boolean not null default true,
  dates     boolean not null default true,
  memories  boolean not null default true,
  moods     boolean not null default true,
  presence  boolean not null default true
);

-- indexes
create index if not exists idx_members_user      on public.members (user_id);
create index if not exists idx_messages_couple   on public.messages (couple_id, created_at desc);
create index if not exists idx_reactions_msg     on public.reactions (message_id);
create index if not exists idx_reads_msg         on public.reads (message_id);
create index if not exists idx_memories_couple   on public.memories (couple_id, happened_on desc);
create index if not exists idx_milestones_couple on public.milestones (couple_id, date);
create index if not exists idx_places_couple     on public.places (couple_id);
create index if not exists idx_songs_couple      on public.songs (couple_id, position);
create index if not exists idx_countdowns_couple on public.countdowns (couple_id, target_at);
create index if not exists idx_surprises_to      on public.surprises (to_user, unlock_at);
create index if not exists idx_dates_couple      on public.dates (couple_id, created_at desc);
create index if not exists idx_games_couple      on public.game_sessions (couple_id, status);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

-- full row images on DELETE/UPDATE for realtime payloads
alter table public.messages     replica identity full;
alter table public.memories     replica identity full;
alter table public.milestones   replica identity full;
alter table public.places       replica identity full;
alter table public.songs        replica identity full;
alter table public.countdowns   replica identity full;
alter table public.surprises    replica identity full;
alter table public.dates        replica identity full;
alter table public.couples      replica identity full;
alter table public.members      replica identity full;
alter table public.game_sessions replica identity full;
alter table public.reactions    replica identity full;
alter table public.reads        replica identity full;

-- ───────────────────────────────────────────────
-- 2. HELPERS
-- ───────────────────────────────────────────────

-- Which world is the signed-in user in?
create or replace function public.my_couple_id()
returns uuid language sql stable security definer set search_path = public as $$
  select couple_id from public.members where user_id = auth.uid()
$$;

-- "today at 6 AM" / "March 3 at 9 PM" for surprise copy
create or replace function public.when_label(ts timestamptz)
returns text language plpgsql immutable as $$
declare d text;
begin
  if (ts at time zone 'utc')::date = (now() at time zone 'utc')::date then
    return 'today at ' || to_char(ts, 'FMHH12:MI AM');
  elsif (ts at time zone 'utc')::date = ((now() at time zone 'utc')::date + 1) then
    return 'tomorrow at ' || to_char(ts, 'FMHH12:MI AM');
  end if;
  return to_char(ts, 'FMMonth FMDD') || ' at ' || to_char(ts, 'FMHH12:MI AM');
end $$;

-- The other half of the couple (null if solo)
create or replace function public.my_partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.members
  where couple_id = public.my_couple_id() and user_id <> auth.uid()
$$;

-- Insert a notification for the partner, respecting their preferences
create or replace function public.notify_partner(p_type text, p_body text, p_data jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare partner uuid := public.my_partner_id();
begin
  if partner is null then return; end if;
  insert into public.notifications (user_id, type, body, data, silent)
  values (partner, p_type, p_body, coalesce(p_data, '{}'::jsonb),
    coalesce((select not p from (select case p_type
      when 'messages'  then messages
      when 'surprises' then surprises
      when 'dates'     then dates
      when 'memories'  then memories
      when 'moods'     then moods
      else presence end as p from public.notif_prefs where user_id = partner) t), false));
end $$;

-- ───────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ───────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.couples       enable row level security;
alter table public.members       enable row level security;
alter table public.messages      enable row level security;
alter table public.reactions     enable row level security;
alter table public.reads         enable row level security;
alter table public.memories      enable row level security;
alter table public.milestones    enable row level security;
alter table public.places        enable row level security;
alter table public.songs         enable row level security;
alter table public.countdowns    enable row level security;
alter table public.surprises     enable row level security;
alter table public.dates         enable row level security;
alter table public.game_sessions enable row level security;
alter table public.notifications enable row level security;
alter table public.notif_prefs   enable row level security;

-- profiles: you see and edit your own; partners see each other via RPC only
create policy "own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- couples: both members read; both may update (room, theme, name…)
create policy "couple read" on public.couples
  for select to authenticated using (id = public.my_couple_id());
create policy "couple update" on public.couples
  for update to authenticated using (id = public.my_couple_id()) with check (id = public.my_couple_id());

-- members: you can see both rows of your world; you insert via RPCs
create policy "members read" on public.members
  for select to authenticated
  using (user_id = auth.uid() or couple_id = public.my_couple_id());
create policy "members update own" on public.members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages: couple-scoped; only the sender can edit (soft-delete) their own
create policy "messages read" on public.messages
  for select to authenticated using (couple_id = public.my_couple_id());
create policy "messages insert" on public.messages
  for insert to authenticated with check (couple_id = public.my_couple_id() and sender = auth.uid());
create policy "messages update own" on public.messages
  for update to authenticated using (couple_id = public.my_couple_id() and sender = auth.uid())
  with check (couple_id = public.my_couple_id() and sender = auth.uid());

create policy "reactions all" on public.reactions
  for all to authenticated using (exists (select 1 from public.messages m
    where m.id = message_id and m.couple_id = public.my_couple_id()))
  with check (exists (select 1 from public.messages m
    where m.id = message_id and m.couple_id = public.my_couple_id()) and user_id = auth.uid());

create policy "reads all" on public.reads
  for all to authenticated using (exists (select 1 from public.messages m
    where m.id = message_id and m.couple_id = public.my_couple_id()))
  with check (exists (select 1 from public.messages m
    where m.id = message_id and m.couple_id = public.my_couple_id()));

-- simple couple-scoped content tables
create policy "memories all" on public.memories for all to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy "milestones all" on public.milestones for all to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy "places all" on public.places for all to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy "songs all" on public.songs for all to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy "countdowns all" on public.countdowns for all to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy "dates all" on public.dates for all to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());

-- game sessions: readable by the couple; all writes go through the
-- SECURITY DEFINER game RPCs (direct writes are revoked below)
create policy "games read" on public.game_sessions
  for select to authenticated using (couple_id = public.my_couple_id());

-- surprises: THE SEAL. The creator always sees their own; the recipient
-- can only see a row once its unlock time has passed. Until then the
-- payload does not leave the database — for anyone.
create policy "surprises insert" on public.surprises
  for insert to authenticated with check (couple_id = public.my_couple_id() and from_user = auth.uid());
create policy "surprises read" on public.surprises
  for select to authenticated using (
    couple_id = public.my_couple_id()
    and (from_user = auth.uid() or (to_user = auth.uid() and unlock_at <= now()))
  );
create policy "surprises open" on public.surprises
  for update to authenticated using (to_user = auth.uid() and unlock_at <= now())
  with check (to_user = auth.uid() and unlock_at <= now());
create policy "surprises delete" on public.surprises
  for delete to authenticated using (from_user = auth.uid());

-- notifications: yours only; inserted by triggers
create policy "notifications read" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications mark read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "prefs own" on public.notif_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- only RPCs may write game sessions
revoke insert, update, delete on public.game_sessions from authenticated, anon;

-- ───────────────────────────────────────────────
-- 4. TRIGGERS
-- ───────────────────────────────────────────────

-- new auth user → profile + default preferences
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, tz)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'tz')
  on conflict (id) do nothing;
  insert into public.notif_prefs (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- partner joined your world
create or replace function public.notify_member_joined()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select name into nm from public.profiles where id = new.user_id;
  perform public.notify_partner('presence', coalesce(nm, 'Someone') || ' just walked in. You''re together now.');
  return new;
end $$;

drop trigger if exists on_member_joined on public.members;
create trigger on_member_joined after insert on public.members
  for each row execute function public.notify_member_joined();

-- new message → partner notification
create or replace function public.notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text; preview text;
begin
  if new.sender = auth.uid() then
    select name into nm from public.profiles where id = new.sender;
    preview := case new.type
      when 'image' then 'sent a photo'
      when 'voice' then 'sent a voice note'
      else left(new.body, 80) end;
    perform public.notify_partner('messages', coalesce(nm, 'Someone') || ': ' || preview,
      jsonb_build_object('messageId', new.id));
  end if;
  return new;
end $$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created after insert on public.messages
  for each row execute function public.notify_message();

-- memories / milestones / places / songs → partner notification
create or replace function public.notify_keepsake()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select name into nm from public.profiles where id = auth.uid();
  nm := coalesce(nm, 'Someone');
  if tg_table_name = 'memories' then
    perform public.notify_partner('memories', nm || ' saved a memory: “' || left(new.title, 60) || '”',
      jsonb_build_object('memoryId', new.id));
  elsif tg_table_name = 'milestones' then
    perform public.notify_partner('memories', nm || ' added to your story: “' || left(new.title, 60) || '”');
  elsif tg_table_name = 'places' then
    perform public.notify_partner('memories', nm || ' added ' || new.name || ' to your places.');
  elsif tg_table_name = 'songs' then
    perform public.notify_partner('memories', nm || ' added “' || left(new.title, 60) || '” to your songs.');
  end if;
  return new;
end $$;

drop trigger if exists on_memory_created on public.memories;
create trigger on_memory_created after insert on public.memories
  for each row execute function public.notify_keepsake();
drop trigger if exists on_milestone_created on public.milestones;
create trigger on_milestone_created after insert on public.milestones
  for each row execute function public.notify_keepsake();
drop trigger if exists on_place_created on public.places;
create trigger on_place_created after insert on public.places
  for each row execute function public.notify_keepsake();
drop trigger if exists on_song_created on public.songs;
create trigger on_song_created after insert on public.songs
  for each row execute function public.notify_keepsake();

-- surprise prepared → "they left you something" (no contents, ever)
create or replace function public.notify_surprise()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_partner('surprises', 'They left you a surprise. It opens ' || public.when_label(new.unlock_at) || '.');
  return new;
end $$;

drop trigger if exists on_surprise_created on public.surprises;
create trigger on_surprise_created after insert on public.surprises
  for each row execute function public.notify_surprise();

-- date started → partner notification
create or replace function public.notify_date()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select name into nm from public.profiles where id = auth.uid();
    perform public.notify_partner('dates', coalesce(nm, 'Someone') || ' started your date — “' || coalesce(new.plan->>'title', 'tonight') || '”. It''s on.',
      jsonb_build_object('dateId', new.id));
  end if;
  return new;
end $$;

drop trigger if exists on_date_changed on public.dates;
create trigger on_date_changed after update on public.dates
  for each row execute function public.notify_date();

-- mood changes → gentle notification when it matters
create or replace function public.notify_mood()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if new.user_id = auth.uid() and new.mood is distinct from old.mood
     and new.mood in ('needyou', 'low', 'overwhelmed', 'tired') then
    select name into nm from public.profiles where id = auth.uid();
    perform public.notify_partner('moods', coalesce(nm, 'Someone') || case new.mood
      when 'needyou' then ' needs you right now.'
      when 'low' then ' is feeling low tonight.'
      when 'overwhelmed' then ' is feeling overwhelmed tonight.'
      when 'tired' then ' is feeling tired tonight.' end);
  end if;
  return new;
end $$;

drop trigger if exists on_mood_changed on public.members;
create trigger on_mood_changed after update on public.members
  for each row execute function public.notify_mood();

-- game session touch
create or replace function public.touch_game()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists on_game_touch on public.game_sessions;
create trigger on_game_touch before update on public.game_sessions
  for each row execute function public.touch_game();

-- ───────────────────────────────────────────────
-- 5. RPCs — world lifecycle
-- ───────────────────────────────────────────────

create or replace function public.create_world(p_your_name text, p_partner_name text)
returns public.couples language plpgsql security definer set search_path = public as $$
declare words text[] := array['LUNA','HAVEN','EMBER','WILLOW','ORION','MIRA','JUNIPER','VESPER','SAFFRON','ATLAS','HAZEL','SOLACE','AURELIA','CINDER','MARLOW','INDIGO'];
  code text; c public.couples;
begin
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'You''re already in a world. Leave it from Settings before starting a new one.';
  end if;
  p_your_name := left(btrim(coalesce(p_your_name, '')), 40);
  p_partner_name := left(btrim(coalesce(p_partner_name, '')), 40);
  if p_your_name = '' then raise exception 'What should we call you?'; end if;
  if p_partner_name = '' then raise exception 'What''s your partner''s name?'; end if;

  loop
    code := words[1 + floor(random() * array_length(words, 1))::int] || '-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from public.couples where invite_code = code);
  end loop;

  insert into public.couples (name, invite_code)
    values (p_your_name || ' & ' || p_partner_name, code) returning * into c;
  insert into public.members (couple_id, user_id, display_name, accent)
    values (c.id, auth.uid(), p_your_name, 'rose');
  return c;
end $$;

create or replace function public.join_world(p_code text)
returns public.couples language plpgsql security definer set search_path = public as $$
declare c public.couples; n int; dn text;
begin
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'You''re already in a world.';
  end if;
  p_code := upper(btrim(coalesce(p_code, '')));
  perform pg_advisory_xact_lock(hashtext(p_code));
  select * into c from public.couples where invite_code = p_code;
  if not found then raise exception 'That code doesn''t match any world. Check with your partner?'; end if;
  select count(*) into n from public.members where couple_id = c.id;
  if n >= 2 then raise exception 'That world is already full — it''s built for two.'; end if;
  select name into dn from public.profiles where id = auth.uid();
  insert into public.members (couple_id, user_id, display_name, accent)
    values (c.id, auth.uid(), left(coalesce(dn, 'Partner'), 40), 'amber');
  return c;
end $$;

create or replace function public.dissolve_world(p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_couple_id();
begin
  if cid is null then raise exception 'Nothing to leave.'; end if;
  if coalesce(p_confirm, '') <> 'goodbye' then
    raise exception 'Type "goodbye" to confirm — this removes your world forever.';
  end if;
  delete from public.couples where id = cid;
end $$;

-- the /me snapshot (mirrors the self-hosted server's shape)
create or replace function public.me_snapshot()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.members; p public.profiles; c public.couples;
  pm public.members; pp public.profiles; unread int; n int;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return null; end if;
  select * into m from public.members where user_id = auth.uid();
  if not found then
    return jsonb_build_object(
      'user', jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email, 'avatar', p.avatar_path, 'tz', p.tz, 'demo', false, 'member', null),
      'couple', null, 'partner', null, 'unread', 0,
      'demo', jsonb_build_object('isDemoUser', false, 'coupleIsDemo', false));
  end if;
  select * into c from public.couples where id = m.couple_id;
  select * into pm from public.members where couple_id = c.id and user_id <> p.id;
  select * into pp from public.profiles where id = pm.user_id;
  select count(*) into unread from public.notifications where user_id = p.id and read_at is null;
  select count(*) into n from public.members where couple_id = c.id;
  return jsonb_build_object(
    'user', jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email, 'avatar', p.avatar_path, 'tz', p.tz, 'demo', false,
      'member', jsonb_build_object('displayName', m.display_name, 'accent', m.accent, 'hair', m.hair)),
    'couple', jsonb_build_object('id', c.id, 'name', c.name, 'inviteCode', c.invite_code, 'anniversary', c.anniversary,
      'theme', c.theme, 'plan', c.plan, 'room', c.room, 'demo', c.demo, 'members', n,
      'createdAt', (extract(epoch from c.created_at) * 1000)::bigint),
    'partner', case when pp.id is null then null else jsonb_build_object(
      'id', pp.id, 'name', pp.name, 'avatar', pp.avatar_path, 'tz', pp.tz,
      'displayName', pm.display_name, 'accent', pm.accent, 'hair', pm.hair,
      'mood', jsonb_build_object('mood', pm.mood, 'updatedAt', pm.mood_updated_at), 'demo', false) end,
    'unread', unread,
    'demo', jsonb_build_object('isDemoUser', false, 'coupleIsDemo', c.demo));
end $$;

create or replace function public.mark_all_read()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.reads (message_id, user_id)
  select id, auth.uid() from public.messages
  where couple_id = public.my_couple_id() and sender <> auth.uid()
  on conflict do nothing;
end $$;

-- presence-driven "they walked in" (client calls this when it notices)
create or replace function public.push_notification(p_type text, p_body text, p_data jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_partner(p_type, p_body, p_data);
end $$;

-- ───────────────────────────────────────────────
-- 6. RPCs — surprises
-- ───────────────────────────────────────────────

-- sanitized list: creator sees everything they made; recipient sees
-- metadata only until unlock, full payload after
create or replace function public.list_surprises()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare out jsonb := '[]';
begin
  select coalesce(jsonb_agg(row_to_json(s) order by s."unlockAt" desc), '[]'::jsonb) into out
  from (
    select id, type, from_user, to_user,
           (extract(epoch from unlock_at) * 1000)::bigint as "unlockAt",
           (extract(epoch from coalesce(opened_at, to_timestamp(0))) * 1000)::bigint as "openedAt",
           (extract(epoch from created_at) * 1000)::bigint as "createdAt",
           from_user = auth.uid() as mine,
           unlock_at <= now() as unlocked,
           to_user = auth.uid() as "forMe",
           case when from_user = auth.uid() or unlock_at <= now() then payload else null end as payload
    from public.surprises
    where couple_id = public.my_couple_id()
  ) s;
  return out;
end $$;

create or replace function public.open_surprise(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.surprises;
begin
  select * into s from public.surprises where id = p_id for update;
  if not found or s.couple_id <> public.my_couple_id() then
    raise exception 'That surprise is gone.';
  end if;
  if s.to_user <> auth.uid() then raise exception 'This one isn''t yours to open.'; end if;
  if s.unlock_at > now() then raise exception 'Not yet. It''s still sealed.'; end if;
  if s.opened_at is null then
    update public.surprises set opened_at = now() where id = p_id returning * into s;
  end if;
  return jsonb_build_object('id', s.id, 'type', s.type, 'fromUser', s.from_user, 'toUser', s.to_user,
    'unlockAt', (extract(epoch from s.unlock_at) * 1000)::bigint,
    'openedAt', (extract(epoch from s.opened_at) * 1000)::bigint,
    'createdAt', (extract(epoch from s.created_at) * 1000)::bigint,
    'mine', s.from_user = auth.uid(), 'unlocked', true, 'forMe', s.to_user = auth.uid(), 'payload', s.payload);
end $$;

-- announce the moment a surprise unlocks (idempotent; clients call on
-- boot and periodically)
create or replace function public.collect_unlocked_surprises()
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  for s in select * from public.surprises
           where to_user = auth.uid() and notified_at is null and unlock_at <= now()
  loop
    update public.surprises set notified_at = now() where id = s.id;
    insert into public.notifications (user_id, type, body, data)
    values (s.to_user, 'surprises', 'A surprise just unlocked. Open it when you''re ready.',
            jsonb_build_object('surpriseId', s.id));
  end loop;
end $$;

-- ───────────────────────────────────────────────
-- 7. RPCs — games (server-authoritative)
--    Client-supplied decks (memory glyphs, question sets, prompts) are
--    convenience data; all turn/win logic is enforced here.
-- ───────────────────────────────────────────────

create or replace function public.game_start(p_game text, p_state jsonb default '{}')
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s public.game_sessions; st jsonb := coalesce(p_state, '{}'::jsonb);
  cid uuid := public.my_couple_id();
begin
  if cid is null then raise exception 'Create your world first.'; end if;
  if public.my_partner_id() is null then raise exception 'You''ll need your partner in the world first — invite them from Our Place.'; end if;
  if p_game not in ('ttt','c4','memory','wyr','thisthat','draw') then raise exception 'Unknown game.'; end if;

  select * into s from public.game_sessions
  where couple_id = cid and game = p_game and status = 'active';
  if found then return s; end if;

  if p_game = 'ttt' then
    st := jsonb_build_object('board', '[null,null,null,null,null,null,null,null,null]'::jsonb, 'history', '{}'::jsonb);
  elsif p_game = 'c4' then
    st := jsonb_build_object('board', (select jsonb_agg(null::jsonb) from generate_series(1,42)), 'moves', '[]'::jsonb);
  elsif p_game = 'memory' then
    if jsonb_typeof(st->'deck') <> 'array' or jsonb_array_length(st->'deck') < 4 or mod(jsonb_array_length(st->'deck'), 2) <> 0 then
      raise exception 'The deck didn''t come through.';
    end if;
    st := st || jsonb_build_object('revealed', '[]'::jsonb, 'matched', '[]'::jsonb, 'scores', '{}'::jsonb);
  elsif p_game in ('wyr','thisthat') then
    if jsonb_typeof(st->'qs') <> 'array' or jsonb_array_length(st->'qs') = 0 then
      raise exception 'The deck didn''t come through.';
    end if;
    st := st || jsonb_build_object('idx', 0, 'answers', '{}'::jsonb, 'revealed', 'false', 'score', jsonb_build_object('both', 0, 'total', 0));
  elsif p_game = 'draw' then
    st := jsonb_build_object('prompt', coalesce(st->>'prompt', 'anything at all'), 'strokes', '[]'::jsonb, 'round', 1);
  end if;

  insert into public.game_sessions (couple_id, game, state, turn)
  values (cid, p_game, st, case when p_game in ('ttt','c4','memory') then auth.uid() end)
  returning * into s;
  return s;
end $$;

create or replace function public.game_reset(p_session uuid, p_state jsonb default '{}')
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare old public.game_sessions; st jsonb := coalesce(p_state, '{}'::jsonb);
begin
  select * into old from public.game_sessions where id = p_session;
  if not found or old.couple_id <> public.my_couple_id() then raise exception 'That game is gone.'; end if;

  if old.game = 'ttt' then
    st := jsonb_build_object('board', '[null,null,null,null,null,null,null,null,null]'::jsonb,
                             'history', coalesce(old.state->'history', '{}'::jsonb));
  elsif old.game = 'c4' then
    st := jsonb_build_object('board', (select jsonb_agg(null::jsonb) from generate_series(1,42)), 'moves', '[]'::jsonb);
  elsif old.game = 'memory' then
    st := st || jsonb_build_object('revealed', '[]'::jsonb, 'matched', '[]'::jsonb, 'scores', '{}'::jsonb);
  elsif old.game in ('wyr','thisthat') then
    st := st || jsonb_build_object('idx', 0, 'answers', '{}'::jsonb, 'revealed', 'false', 'score', jsonb_build_object('both', 0, 'total', 0));
  elsif old.game = 'draw' then
    st := jsonb_build_object('prompt', coalesce(st->>'prompt', 'anything at all'), 'strokes', '[]'::jsonb, 'round', 1);
  end if;

  update public.game_sessions
  set state = st, turn = case when old.game in ('ttt','c4','memory') then auth.uid() end,
      status = 'active', winner = null
  where id = p_session returning * into old;
  return old;
end $$;

create or replace function public.game_move(p_session uuid, p_payload jsonb)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s public.game_sessions; st jsonb; me uuid := auth.uid(); other uuid;
  i int; r int; c int; row_i int; c2 int; v text;
  winner text; card jsonb; gx text; gy text; k text; v1 text; v2 text; n2 int;
  q jsonb; choice int; ans text; stroke jsonb; hist jsonb; total int;
begin
  select * into s from public.game_sessions where id = p_session for update;
  if not found or s.couple_id <> public.my_couple_id() then raise exception 'That game is gone.'; end if;
  if s.status <> 'active' then raise exception 'This game has finished — start a new round.'; end if;
  if s.couple_id <> public.my_couple_id() then raise exception 'This game isn''t yours.'; end if;
  other := public.my_partner_id();
  st := s.state;
  p_payload := coalesce(p_payload, '{}'::jsonb);

  ---------------------------------------------------------------- ttt
  if s.game = 'ttt' then
    if st ? 'winner' then raise exception 'Round is over — start a new one.'; end if;
    if s.turn is distinct from me then raise exception 'Their move first.'; end if;
    i := nullif(p_payload->>'move', '')::int;
    if i is null or i < 0 or i > 8 then raise exception 'That square doesn''t exist.'; end if;
    if coalesce(st->'board'->>i, '') <> '' then raise exception 'That square is taken.'; end if;
    st := jsonb_set(st, array['board', i::text], to_jsonb(me));

    winner := null;
    if st->'board'->>0 is not null and st->'board'->>0 = st->'board'->>1 and st->'board'->>1 = st->'board'->>2 then winner := st->'board'->>0; end if;
    if winner is null and st->'board'->>3 is not null and st->'board'->>3 = st->'board'->>4 and st->'board'->>4 = st->'board'->>5 then winner := st->'board'->>3; end if;
    if winner is null and st->'board'->>6 is not null and st->'board'->>6 = st->'board'->>7 and st->'board'->>7 = st->'board'->>8 then winner := st->'board'->>6; end if;
    if winner is null and st->'board'->>0 is not null and st->'board'->>0 = st->'board'->>3 and st->'board'->>3 = st->'board'->>6 then winner := st->'board'->>0; end if;
    if winner is null and st->'board'->>1 is not null and st->'board'->>1 = st->'board'->>4 and st->'board'->>4 = st->'board'->>7 then winner := st->'board'->>1; end if;
    if winner is null and st->'board'->>2 is not null and st->'board'->>2 = st->'board'->>5 and st->'board'->>5 = st->'board'->>8 then winner := st->'board'->>2; end if;
    if winner is null and st->'board'->>0 is not null and st->'board'->>0 = st->'board'->>4 and st->'board'->>4 = st->'board'->>8 then winner := st->'board'->>0; end if;
    if winner is null and st->'board'->>2 is not null and st->'board'->>2 = st->'board'->>4 and st->'board'->>4 = st->'board'->>6 then winner := st->'board'->>2; end if;

    if winner is not null then
      if winner <> 'draw' then
        hist := coalesce(st->'history', '{}'::jsonb) || jsonb_build_object(me::text, to_jsonb(coalesce((st->'history'->>me::text)::int, 0) + 1));
        st := st || jsonb_build_object('history', hist);
        s.winner := me;
      end if;
      st := st || jsonb_build_object('winner', winner);
      s.status := 'done';
    else
      select count(*) into total from jsonb_array_elements_text(st->'board') e where e is not null;
      if total = 9 then
        st := st || jsonb_build_object('winner', 'draw');
        s.status := 'done';
      else
        s.turn := other;
      end if;
    end if;

  ---------------------------------------------------------------- c4
  elsif s.game = 'c4' then
    if s.turn is distinct from me then raise exception 'Their move first.'; end if;
    c := nullif(p_payload->>'move', '')::int;
    if c is null or c < 0 or c > 6 then raise exception 'Not a column.'; end if;
    row_i := -1;
    for r in reverse 5..0 loop
      if row_i < 0 and coalesce(st->'board'->>(r * 7 + c), '') = '' then row_i := r; end if;
    end loop;
    if row_i < 0 then raise exception 'That column is full.'; end if;
    st := jsonb_set(st, array['board', (row_i * 7 + c)::text], to_jsonb(me));
    st := st || jsonb_build_object('lastMove', row_i * 7 + c);

    winner := null;
    for r in 0..5 loop
      for c2 in 0..6 loop
        v := st->'board'->>(r * 7 + c2);
        if v is not null and winner is null then
          if (st->'board'->>(r * 7 + c2 + 1)) = v and (st->'board'->>(r * 7 + c2 + 2)) = v and (st->'board'->>(r * 7 + c2 + 3)) = v then winner := v; end if;
          if (st->'board'->>((r + 1) * 7 + c2)) = v and (st->'board'->>((r + 2) * 7 + c2)) = v and (st->'board'->>((r + 3) * 7 + c2)) = v then winner := v; end if;
          if (st->'board'->>((r + 1) * 7 + c2 + 1)) = v and (st->'board'->>((r + 2) * 7 + c2 + 2)) = v and (st->'board'->>((r + 3) * 7 + c2 + 3)) = v then winner := v; end if;
          if c2 >= 3 and (st->'board'->>((r + 1) * 7 + c2 - 1)) = v and (st->'board'->>((r + 2) * 7 + c2 - 2)) = v and (st->'board'->>((r + 3) * 7 + c2 - 3)) = v then winner := v; end if;
        end if;
      end loop;
    end loop;

    if winner is not null then
      s.winner := me; s.status := 'done';
    else
      select count(*) into total from jsonb_array_elements_text(st->'board') e where e is not null;
      if total = 42 then s.status := 'done'; st := st || jsonb_build_object('winner', 'draw'); end if;
      s.turn := other;
    end if;

  ---------------------------------------------------------------- memory
  elsif s.game = 'memory' then
    if p_payload->>'action' = 'clear' then
      if jsonb_array_length(coalesce(st->'revealed', '[]'::jsonb)) = 2 then
        st := jsonb_set(st, '{revealed}', '[]'::jsonb) - 'reveal_clear_at';
        update public.game_sessions set state = st, updated_at = now() where id = s.id returning * into s;
        return s;
      end if;
      return s;
    end if;
    if s.turn is distinct from me then raise exception 'Their turn first.'; end if;
    i := nullif(p_payload->>'move', '')::int;
    select d into card from jsonb_array_elements(st->'deck') d where (d->>'i')::int = i;
    if card is null then raise exception 'Pick a hidden card.'; end if;
    gx := card->>'g';
    if (st->'matched') ? gx then raise exception 'Pick a hidden card.'; end if;
    if (st->'revealed') ? i::text then raise exception 'Pick a hidden card.'; end if;
    st := jsonb_set(st, '{revealed}', (st->'revealed') || to_jsonb(i));

    if jsonb_array_length(st->'revealed') = 2 then
      select e->>'g' into gx from jsonb_array_elements(st->'deck') e where (e->>'i')::int = (st->'revealed'->>0)::int;
      select e->>'g' into gy from jsonb_array_elements(st->'deck') e where (e->>'i')::int = (st->'revealed'->>1)::int;
      if gx = gy then
        st := jsonb_set(st, '{matched}', (st->'matched') || to_jsonb(gx));
        st := st || jsonb_build_object('scores', coalesce(st->'scores', '{}'::jsonb)
                 || jsonb_build_object(me::text, to_jsonb(coalesce((st->'scores'->>me::text)::int, 0) + 1)));
        st := jsonb_set(st, '{revealed}', '[]'::jsonb);
        if jsonb_array_length(st->'matched') >= jsonb_array_length(st->'deck') / 2 then
          st := st || jsonb_build_object('winner', 'done');
          s.status := 'done';
        end if;
      else
        s.turn := other;
        st := st || jsonb_build_object('reveal_clear_at', (extract(epoch from now()) * 1000 + 1100)::bigint);
      end if;
    end if;

  ---------------------------------------------------------------- duels
  elsif s.game in ('wyr', 'thisthat') then
    q := st->'qs'->(coalesce((st->>'idx'), '0')::int);
    if q is null then raise exception 'The deck ran out.'; end if;
    if p_payload->>'action' = 'next' then
      if (st->>'idx')::int < jsonb_array_length(st->'qs') - 1 then
        st := st || jsonb_build_object('idx', to_jsonb((st->>'idx')::int + 1), 'answers', '{}'::jsonb, 'revealed', 'false');
      else
        st := st || jsonb_build_object('finished', 'true');
        s.status := 'done';
      end if;
    else
      if (st->'answers') ? me::text then raise exception 'You already answered this one.'; end if;
      if q ? 'options' then
        choice := nullif(p_payload->>'move', '')::int;
        if choice is null or choice not in (0, 1) then raise exception 'Pick one.'; end if;
        st := st || jsonb_build_object('answers', (st->'answers') || jsonb_build_object(me::text, choice));
      else
        ans := left(btrim(coalesce(p_payload->>'move', '')), 300);
        if ans = '' then raise exception 'Pick one.'; end if;
        st := st || jsonb_build_object('answers', (st->'answers') || jsonb_build_object(me::text, ans));
      end if;
      if (select count(*) from jsonb_object_keys(st->'answers')) = 2 then
        n2 := 0; v1 := null; v2 := null;
        for k in select jsonb_object_keys(st->'answers') loop
          n2 := n2 + 1;
          if n2 = 1 then v1 := st->'answers'->>k; else v2 := st->'answers'->>k; end if;
        end loop;
        st := st || jsonb_build_object('revealed', 'true',
          'score', jsonb_build_object('both', coalesce((st->'score'->>'both')::int, 0) + (case when v1 = v2 then 1 else 0 end),
                                      'total', coalesce((st->'score'->>'total')::int, 0) + 1));
      end if;
    end if;

  ---------------------------------------------------------------- draw
  elsif s.game = 'draw' then
    if p_payload->>'action' = 'stroke' then
      stroke := p_payload->'stroke';
      if jsonb_typeof(stroke) <> 'array' or jsonb_array_length(stroke) > 600 then raise exception 'That stroke didn''t come through.'; end if;
      if jsonb_array_length(coalesce(st->'strokes', '[]'::jsonb)) >= 400 then raise exception 'The canvas is full — clear it.'; end if;
      stroke := stroke || jsonb_build_object('by', me, 'color', left(coalesce(p_payload->>'color', '#26201c'), 12),
                                             'size', least(coalesce(nullif(p_payload->>'size','')::int, 3), 30));
      st := jsonb_set(st, '{strokes}', (coalesce(st->'strokes', '[]'::jsonb) || jsonb_build_array(stroke)));
    elsif p_payload->>'action' = 'clear' then
      st := jsonb_set(st, '{strokes}', '[]'::jsonb);
    elsif p_payload->>'action' = 'next' then
      st := jsonb_build_object('prompt', left(coalesce(p_payload->>'prompt', 'anything at all'), 120),
                               'strokes', '[]'::jsonb, 'round', to_jsonb(coalesce((st->>'round')::int, 1) + 1));
    else
      raise exception 'Unknown drawing action.';
    end if;
  end if;

  update public.game_sessions set state = st, turn = s.turn, status = s.status, winner = s.winner
  where id = p_session returning * into s;
  return s;
end $$;

revoke execute on function public.game_move(uuid, jsonb) from anon;
revoke execute on function public.game_start(text, jsonb) from anon;
revoke execute on function public.game_reset(uuid, jsonb) from anon;
revoke execute on function public.create_world(text, text) from anon;
revoke execute on function public.join_world(text) from anon;
revoke execute on function public.dissolve_world(text) from anon;
revoke execute on function public.open_surprise(uuid) from anon;

-- ───────────────────────────────────────────────
-- 8. STORAGE — private bucket "media", couple-scoped
-- ───────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "media couple read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_couple_id()::text);

create policy "media couple write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_couple_id()::text);

create policy "media couple delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_couple_id()::text);

-- ───────────────────────────────────────────────
-- 9. REALTIME
-- ───────────────────────────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.messages;
  alter publication supabase_realtime add table public.reactions;
  alter publication supabase_realtime add table public.reads;
  alter publication supabase_realtime add table public.memories;
  alter publication supabase_realtime add table public.milestones;
  alter publication supabase_realtime add table public.places;
  alter publication supabase_realtime add table public.songs;
  alter publication supabase_realtime add table public.countdowns;
  alter publication supabase_realtime add table public.surprises;
  alter publication supabase_realtime add table public.dates;
  alter publication supabase_realtime add table public.game_sessions;
  alter publication supabase_realtime add table public.couples;
  alter publication supabase_realtime add table public.members;
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null; -- table already in the publication
end $$;

-- Done. Verify with:
--   select * from pg_tables where schemaname = 'public';
--   select tablename, policyname from pg_policies where schemaname = 'public';
