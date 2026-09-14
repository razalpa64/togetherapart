-- Local stand-ins for the Supabase platform — validation only, never run on Supabase.
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid $$;

create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false);
create table if not exists storage.objects (
  id uuid default gen_random_uuid(),
  bucket_id text, name text, owner uuid,
  primary key (bucket_id, name)
);
create or replace function storage.foldername(nm text) returns text[] language sql immutable as
$$ select string_to_array(nm, '/') $$;

create publication supabase_realtime;

do $$
declare r text;
begin
  foreach r in array array['authenticated', 'anon'] loop
    if not exists (select from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;
