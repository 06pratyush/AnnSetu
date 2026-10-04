"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { homeFor, useAuth } from "@/lib/auth/auth-provider";
import { ConfigMissing } from "@/lib/auth/role-guard";
import { errorMessage } from "@/lib/errors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const { status, session, profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));

  useEffect(() => {
    if (status === "ready" && session && profile) router.replace(profile.onboarded && next ? next : homeFor(profile));
  }, [status, session, profile, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(errorMessage(err, t));
  }

  if (!isSupabaseConfigured) return <ConfigMissing />;

  return (
    <Card>
      <CardHeader>
        <h1 className="font-display text-h1 font-bold text-ink">{t("auth.loginTitle")}</h1>
        <p className="text-body text-ink-muted">{t("auth.loginBody")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field id="email" label={t("common.email")}>
            <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field id="password" label={t("auth.password")}>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Link href="/forgot-password" className="self-start text-small font-semibold text-ink underline underline-offset-4">
            {t("auth.forgotPassword")}
          </Link>
          <Button type="submit" size="lg" loading={busy} disabled={!email || !password}>
            {busy ? t("auth.signingIn") : t("common.signIn")}
          </Button>
          <p className="text-center text-body text-ink-muted">
            {t("auth.noAccount")}{" "}
            <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-ink underline underline-offset-4">
              {t("auth.createAccount")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
