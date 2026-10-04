// In-memory Postgres (PGlite) with small stand-ins for Supabase's auth and storage schemas,
// and every migration applied. Shared by the database tests.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUBS);
  const dir = path.join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, f), "utf8"));
  }
  return db;
}

/** Runs fn as a signed-in user (or anon when userId is null), like a browser request would. */
export async function as<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; set role ${userId ? "authenticated" : "anon"};`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export const rows = async <T = Record<string, unknown>>(db: PGlite, sql: string, params?: unknown[]) =>
  (await db.query<T>(sql, params)).rows;

/** Deterministic pseudo-random numbers so any failure can be replayed. */
export function rng(seed: number) {
  let s = seed;
  const next = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  return {
    next,
    between: (a: number, b: number) => a + next() * (b - a),
    int: (a: number, b: number) => Math.floor(a + next() * (b - a + 1)),
    pick: <T,>(arr: T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

let n = 0;
/** Creates a user through the sign-up trigger; returns its id. */
export async function createUser(db: PGlite, meta: Record<string, unknown>): Promise<string> {
  n += 1;
  const id = `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `u${n}@test`, JSON.stringify(meta)]);
  await db.query(`update public.profiles set onboarded = true, phone = '9000000000' where id = $1`, [id]);
  return id;
}
