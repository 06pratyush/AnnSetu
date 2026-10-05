import { createClient } from "@supabase/supabase-js";
import { createDemoClient } from "./demo/client";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False until the Supabase URL and anon/publishable key are set at build time. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Demo mode: with no Supabase project configured, the whole backend (the same migrations, rules
 * and functions) runs in this browser and keeps its data here. See src/lib/demo.
 */
export const isDemo = !isSupabaseConfigured;

/**
 * One client for the whole app. The anon key is public by design: every table is protected by
 * row-level security, and trusted writes go through Postgres functions.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "annsetu.auth",
      },
    })
  : createDemoClient();

export const STORAGE_BUCKETS = { produce: "produce-images", avatars: "avatars" } as const;
