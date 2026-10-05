-- Demo mode only (no Supabase project configured): small stand-ins for the parts of Supabase the
-- migrations rely on, so every migration, rule and function runs unchanged in the browser (PGlite).
-- Same idea as tests/pg.ts, plus a password hash for sign-in and the photo itself for storage.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text not null,
  raw_user_meta_data jsonb not null default '{}',
  password_hash text,
  created_at timestamptz not null default now()
);
create unique index users_email_idx on auth.users (lower(email));
-- The signed-in user for this statement, set by the demo client for every request.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid default auth.uid(),
  data text, -- the photo as a data: URL
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
create policy "photos: anyone reads" on storage.objects for select using (true);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;
