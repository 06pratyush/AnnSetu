import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False until the Supabase URL and anon/publishable key are set at build time. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * One browser client for the whole app. The anon key is public by design: every table is
 * protected by row-level security, and trusted writes go through Postgres functions.
 */
export const supabase = createClient(url || "http://localhost:54321", anonKey || "missing-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "annsetu.auth",
  },
});

export const STORAGE_BUCKETS = { produce: "produce-images", avatars: "avatars" } as const;
