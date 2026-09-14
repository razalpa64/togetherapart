-- Post-schema grants: mirror what Supabase gives the `authenticated` role,
-- then re-apply the game-session write revocation (RPCs only).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke insert, update, delete on public.game_sessions from authenticated;
