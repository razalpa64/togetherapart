-- Behavioral tests for the Together, Apart Supabase schema.
-- Run via scripts/test-supabase-local.sh. Simulates two (plus one rogue) users
-- by switching role + JWT claims, exactly like Supabase does.

create temp table if not exists results (name text, ok boolean);
grant all on results to authenticated;
insert into results values ('harness started', true);

-- ── fixtures: three users ──────────────────────────────────────────
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (a, 'alina@t.dev', '{"name":"Alina"}'),
    (b, 'bruno@t.dev', '{"name":"Bruno"}'),
    (c, 'chad@t.dev',  '{"name":"Chad"}');
  perform set_config('ta.a', a::text, false);
  perform set_config('ta.b', b::text, false);
  perform set_config('ta.c', c::text, false);
end $$;

-- helper: run as a user
create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  execute format('set role authenticated');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', uid)::text, false);
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', false);
end $$;

-- 1. profile trigger
do $$
declare a text := current_setting('ta.a');
begin
  perform pg_temp.as_user(a);
  insert into results
  select 'profile created on signup', count(*) = 1 from public.profiles where id = a::uuid and name = 'Alina';
end $$;

-- 2. create world + invite code format
do $$
declare a text := current_setting('ta.a'); c public.couples;
begin
  perform pg_temp.as_user(a);
  select * into c from public.create_world('Alina', 'Bruno');
  perform set_config('ta.code', c.invite_code, false);
  perform set_config('ta.couple', c.id::text, false);
  insert into results
  select 'world created with code ' || c.invite_code, c.invite_code ~ '^[A-Z]+-[0-9]{4}$' and c.name = 'Alina & Bruno';
end $$;

-- 3. double-create rejected
do $$
declare a text := current_setting('ta.a'); ok boolean := false;
begin
  perform pg_temp.as_user(a);
  begin
    perform public.create_world('Alina', 'Someone');
  exception when others then ok := true;
  end;
  insert into results values ('double world creation rejected', ok);
end $$;

-- 4. wrong code rejected, right code joins
do $$
declare b text := current_setting('ta.b'); ok boolean := false;
begin
  perform pg_temp.as_user(b);
  begin perform public.join_world('NOPE-9999'); exception when others then ok := true; end;
  insert into results values ('wrong invite code rejected', ok);
  perform public.join_world(current_setting('ta.code'));
  insert into results
  select 'partner joined the world', count(*) = 2 from public.members where couple_id = current_setting('ta.couple')::uuid;
end $$;

-- 5. me_snapshot sees both sides
do $$
declare b text := current_setting('ta.b'); snap jsonb;
begin
  perform pg_temp.as_user(b);
  snap := public.me_snapshot();
  insert into results
  select 'snapshot: partner visible', snap->'partner'->>'name' = 'Alina'
     and snap->'couple'->>'name' = 'Alina & Bruno'
     and (snap->'user'->>'id') = b;
end $$;

-- 6. third user isolation (RLS)
do $$
declare a text := current_setting('ta.a'); c text := current_setting('ta.c');
begin
  perform pg_temp.as_user(a);
  insert into public.messages (couple_id, sender, type, body) values
    (current_setting('ta.couple')::uuid, a::uuid, 'text', 'the lamps are on');
  perform pg_temp.as_admin();
  perform pg_temp.as_user(current_setting('ta.c'));
  insert into results
  select 'RLS: outsider sees zero messages', count(*) = 0 from public.messages;
  insert into results
  select 'RLS: outsider sees zero couples', count(*) = 0 from public.couples;
end $$;

-- 7. message notification trigger
do $$
declare b text := current_setting('ta.b');
begin
  perform pg_temp.as_user(b);
  insert into results
  select 'partner notified of message', count(*) >= 1
    from public.notifications where user_id = b::uuid and body like 'Alina:%';
end $$;

-- 8. surprises: the seal
do $$
declare a text := current_setting('ta.a'); b text := current_setting('ta.b');
  sid uuid; listed jsonb; ok boolean := false;
begin
  perform pg_temp.as_user(a);
  insert into public.surprises (couple_id, from_user, to_user, type, payload, unlock_at)
  values (current_setting('ta.couple')::uuid, a::uuid, b::uuid, 'letter',
          jsonb_build_object('title','For a hard week','body','SECRET-XYZ'),
          now() + interval '1 day')
  returning id into sid;

  -- recipient: metadata only, no payload, no direct row, no early open
  perform pg_temp.as_user(b);
  select list_surprises() into listed;
  insert into results
  select 'seal: recipient sees envelope, not payload',
    exists (select 1 from jsonb_array_elements(listed) e where (e->>'id')::uuid = sid and jsonb_typeof(e->'payload') = 'null' and (e->>'unlocked')::boolean = false);
  insert into results
  select 'seal: RLS hides the row entirely', count(*) = 0 from public.surprises where id = sid;
  begin perform public.open_surprise(sid); exception when others then ok := true; end;
  insert into results values ('seal: early open rejected', ok);

  -- creator always sees their own
  perform pg_temp.as_user(a);
  select list_surprises() into listed;
  insert into results
  select 'seal: creator previews own surprise',
    exists (select 1 from jsonb_array_elements(listed) e where (e->>'id')::uuid = sid and e->'payload'->>'body' = 'SECRET-XYZ');

  -- time passes…
  perform pg_temp.as_admin();
  update public.surprises set unlock_at = now() - interval '1 minute' where id = sid;
  perform pg_temp.as_user(b);
  select list_surprises() into listed;
  insert into results
  select 'seal: unlocked payload now visible',
    exists (select 1 from jsonb_array_elements(listed) e where (e->>'id')::uuid = sid and e->'payload'->>'body' = 'SECRET-XYZ');
  perform public.open_surprise(sid);
  perform public.collect_unlocked_surprises();
  insert into results
  select 'unlock announced via notification', count(*) >= 1
    from public.notifications where user_id = b::uuid and body like 'A surprise just unlocked%';
  perform pg_temp.as_admin();
  update public.surprises set unlock_at = now() + interval '1 day' where id = sid; -- keep sealed for later tests? not needed
end $$;

-- 9. games: tic tac toe
do $$
declare a text := current_setting('ta.a'); b text := current_setting('ta.b'); s public.game_sessions; ok boolean := false;
begin
  perform pg_temp.as_user(a);
  select * into s from public.game_start('ttt', '{}'::jsonb);
  perform set_config('ta.ttt', s.id::text, false);
  perform pg_temp.as_user(b);
  begin perform public.game_move(s.id, jsonb_build_object('move', 0)); exception when others then ok := true; end;
  insert into results values ('ttt: out-of-turn rejected', ok);
  perform pg_temp.as_user(a);
  perform public.game_move(s.id, jsonb_build_object('move', 0));
  perform pg_temp.as_user(b); perform public.game_move(s.id, jsonb_build_object('move', 3));
  perform pg_temp.as_user(a); perform public.game_move(s.id, jsonb_build_object('move', 1));
  perform pg_temp.as_user(b); perform public.game_move(s.id, jsonb_build_object('move', 4));
  ok := false;
  perform pg_temp.as_user(a);
  begin perform public.game_move(s.id, jsonb_build_object('move', 9)); exception when others then ok := true; end;
  insert into results values ('ttt: invalid square rejected', ok);
  select * into s from public.game_move(s.id, jsonb_build_object('move', 2));
  insert into results
  select 'ttt: win detected & series scored', s.status = 'done' and s.winner = a::uuid
    and (s.state->'history'->>a) = '1';
end $$;

-- 10. games: connect four (bottom-row horizontal win)
do $$
declare a text := current_setting('ta.a'); b text := current_setting('ta.b'); s public.game_sessions;
begin
  perform pg_temp.as_user(a);
  select * into s from public.game_start('c4', '{}'::jsonb);
  insert into results select 'c4: board has 42 cells', jsonb_array_length(s.state->'board') = 42;
  perform public.game_move(s.id, jsonb_build_object('move', 0));
  perform pg_temp.as_user(b); perform public.game_move(s.id, jsonb_build_object('move', 6));
  perform pg_temp.as_user(a); perform public.game_move(s.id, jsonb_build_object('move', 1));
  perform pg_temp.as_user(b); perform public.game_move(s.id, jsonb_build_object('move', 6));
  perform pg_temp.as_user(a); perform public.game_move(s.id, jsonb_build_object('move', 2));
  perform pg_temp.as_user(b); perform public.game_move(s.id, jsonb_build_object('move', 6));
  perform pg_temp.as_user(a);
  select * into s from public.game_move(s.id, jsonb_build_object('move', 3));
  insert into results
  select 'c4: four in a row wins', s.status = 'done' and s.winner = a::uuid;
end $$;

-- 11. games: memory match (match → finish; then mismatch → clear → partner turn)
do $$
declare a text := current_setting('ta.a'); b text := current_setting('ta.b'); s public.game_sessions;
  deck jsonb := '[{"i":1,"g":"☾"},{"i":2,"g":"✦"},{"i":3,"g":"☾"},{"i":4,"g":"✦"}]'::jsonb;
begin
  perform pg_temp.as_user(a);
  select * into s from public.game_start('memory', jsonb_build_object('deck', deck));
  select * into s from public.game_move(s.id, jsonb_build_object('move', 1));
  select * into s from public.game_move(s.id, jsonb_build_object('move', 3));
  insert into results
  select 'memory: match scored, same player continues', (s.state->'scores'->>a) = '1'
    and jsonb_array_length(s.state->'matched') = 1 and s.turn = a::uuid;
  select * into s from public.game_move(s.id, jsonb_build_object('move', 2));
  select * into s from public.game_move(s.id, jsonb_build_object('move', 4));
  insert into results
  select 'memory: all pairs found → done', s.status = 'done';

  -- new round: mismatch path
  perform pg_temp.as_user(a);
  select * into s from public.game_start('memory', jsonb_build_object('deck', deck));
  select * into s from public.game_move(s.id, jsonb_build_object('move', 1));
  select * into s from public.game_move(s.id, jsonb_build_object('move', 2));
  insert into results
  select 'memory: mismatch passes turn, keeps reveal', s.turn = b::uuid
    and jsonb_array_length(s.state->'revealed') = 2 and s.state ? 'reveal_clear_at';
  select * into s from public.game_move(s.id, jsonb_build_object('action', 'clear'));
  insert into results
  select 'memory: clear works', jsonb_array_length(s.state->'revealed') = 0;
  perform pg_temp.as_user(b);
  select * into s from public.game_move(s.id, jsonb_build_object('move', 1));
  select * into s from public.game_move(s.id, jsonb_build_object('move', 3));
  insert into results
  select 'memory: partner scores after mismatch', (s.state->'scores'->>b) = '1';
end $$;

-- 12. games: duel (wyr) — answer, reveal, score, next
do $$
declare a text := current_setting('ta.a'); b text := current_setting('ta.b'); s public.game_sessions;
  qs jsonb := '[{"text":"Q1"},{"text":"Q2"}]'::jsonb;
begin
  perform pg_temp.as_user(a);
  select * into s from public.game_start('wyr', jsonb_build_object('qs', qs));
  select * into s from public.game_move(s.id, jsonb_build_object('move', 'coffee'));
  insert into results
  select 'duel: one answer waits', (s.state->'answers'->>a) = 'coffee' and (s.state->>'revealed')::boolean = false;
  perform pg_temp.as_user(b);
  select * into s from public.game_move(s.id, jsonb_build_object('move', 'coffee'));
  insert into results
  select 'duel: match revealed & scored', (s.state->>'revealed')::boolean = true
    and (s.state->'score'->>'both') = '1' and (s.state->'score'->>'total') = '1';
  select * into s from public.game_move(s.id, jsonb_build_object('action', 'next'));
  insert into results
  select 'duel: next question resets answers', (s.state->>'idx')::int = 1 and s.state->'answers' = '{}'::jsonb;
  perform pg_temp.as_user(a);
  select * into s from public.game_move(s.id, jsonb_build_object('move', 'tea'));
  perform pg_temp.as_user(b);
  select * into s from public.game_move(s.id, jsonb_build_object('move', 'coffee'));
  select * into s from public.game_move(s.id, jsonb_build_object('action', 'next'));
  insert into results
  select 'duel: deck ends cleanly', s.status = 'done';
end $$;

-- 13. games: draw — strokes, clear, next prompt
do $$
declare a text := current_setting('ta.a'); b text := current_setting('ta.b'); s public.game_sessions;
begin
  perform pg_temp.as_user(a);
  select * into s from public.game_start('draw', jsonb_build_object('prompt', 'our first date'));
  select * into s from public.game_move(s.id, jsonb_build_object('action', 'stroke', 'stroke', '[[10,10],[20,20]]'::jsonb, 'color', '#B4766B', 'size', 3));
  perform pg_temp.as_user(b);
  select * into s from public.game_move(s.id, jsonb_build_object('action', 'stroke', 'stroke', '[[30,30]]'::jsonb, 'color', '#B98A44', 'size', 5));
  insert into results
  select 'draw: both strokes kept with authors', jsonb_array_length(s.state->'strokes') = 2
    and (s.state->'strokes'->0->>'by') = a and (s.state->'strokes'->1->>'by') = b;
  select * into s from public.game_move(s.id, jsonb_build_object('action', 'next', 'prompt', 'us in ten years'));
  insert into results
  select 'draw: next round clears & re-prompts', (s.state->>'round')::int = 2
    and jsonb_array_length(s.state->'strokes') = 0 and s.state->>'prompt' = 'us in ten years';
end $$;

-- 14. direct game writes must fail (RPC authority only)
do $$
declare ok boolean := false;
begin
  perform pg_temp.as_user(current_setting('ta.a'));
  begin
    update public.game_sessions set state = '{"hacked":true}'::jsonb;
  exception when insufficient_privilege then ok := true;
  when others then ok := true;
  end;
  insert into results values ('games: direct writes rejected', ok);
end $$;

-- 15. reads + mood trigger + dissolve
do $$
declare b text := current_setting('ta.b'); ok boolean := false;
begin
  perform pg_temp.as_user(b);
  perform public.mark_all_read();
  insert into results
  select 'reads recorded', count(*) >= 1 from public.reads r
    join public.messages m on m.id = r.message_id where m.sender <> b::uuid;
  update public.members set mood = 'needyou', mood_updated_at = now() where user_id = b::uuid;
  perform pg_temp.as_user(current_setting('ta.a'));
  insert into results
  select 'mood: need-you notifies partner', count(*) >= 1
    from public.notifications where body like '%needs you right now%';
  perform public.dissolve_world('goodbye');
  insert into results
  select 'dissolve removes the world', count(*) = 0 from public.couples where id = current_setting('ta.couple')::uuid;
end $$;

-- ── summary ────────────────────────────────────────────────────────
select case when bool_and(ok) then '✓ ALL ' || count(*) || ' SUPABASE SCHEMA TESTS PASSED'
            else '✗ FAILURES:' end as summary,
       count(*) filter (where not ok) as failures
from results;
select name, ok from results where not ok;
