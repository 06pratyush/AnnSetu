"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { BuyerDetails, FarmerDetails, Profile } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";

export type FullProfile = Profile & {
  farmer_details: FarmerDetails | null;
  buyer_details: BuyerDetails | null;
};

type AuthState = {
  status: "loading" | "ready";
  session: Session | null;
  profile: FullProfile | null;
  profileError: boolean;
  /** True after the user opened a password-reset link. */
  recovering: boolean;
  refreshProfile: () => Promise<FullProfile | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

async function fetchProfile(userId: string): Promise<FullProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, farmer_details(*), buyer_details(*)")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, farmer_details: one(data.farmer_details), buyer_details: one(data.buyer_details) } as FullProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setLang } = useLang();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoaded(true);
    });
    // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock the client.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setSessionLoaded(true);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setProfileLoadedFor(null);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!userId) return null;
    try {
      const p = await fetchProfile(userId);
      setProfile(p);
      setProfileError(false);
      return p;
    } catch {
      setProfileError(true);
      return null;
    } finally {
      setProfileLoadedFor(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchProfile(userId)
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setProfileError(false);
        if (p?.preferred_lang) {
          let stored: string | null = null;
          try {
            stored = window.localStorage.getItem("annsetu.lang");
          } catch {
            /* ignore */
          }
          if (!stored) setLang(p.preferred_lang);
        }
      })
      .catch(() => active && setProfileError(true))
      .finally(() => active && setProfileLoadedFor(userId));
    return () => {
      active = false;
    };
  }, [userId, setLang]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setProfileLoadedFor(null);
  }, []);

  const status: AuthState["status"] = !sessionLoaded || (userId !== null && profileLoadedFor !== userId) ? "loading" : "ready";

  const value = useMemo<AuthState>(
    () => ({ status, session, profile: userId ? profile : null, profileError, recovering, refreshProfile, signOut }),
    [status, session, profile, userId, profileError, recovering, refreshProfile, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Where a signed-in user belongs. */
export function homeFor(profile: Pick<Profile, "role" | "onboarded"> | null) {
  if (!profile) return "/login";
  if (!profile.onboarded) return "/onboarding";
  return profile.role === "farmer" ? "/farmer" : "/market";
}
