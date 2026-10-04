"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { homeFor, useAuth } from "@/lib/auth/auth-provider";
import { ConfigMissing, PageSkeleton } from "@/lib/auth/role-guard";
import { errorMessage } from "@/lib/errors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, session, profile } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("errors.minLength", { count: 8 }));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(errorMessage(err, t));
      return;
    }
    toast.success(t("auth.passwordUpdated"));
    router.replace(homeFor(profile));
  }

  if (!isSupabaseConfigured) return <ConfigMissing />;
  if (status === "loading") return <PageSkeleton />;

  return (
    <Card>
      <CardHeader>
        <h1 className="font-display text-h1 font-bold text-ink">{t("auth.newPasswordTitle")}</h1>
      </CardHeader>
      <CardContent>
        {!session ? (
          <Alert tone="info">{t("auth.recoveryWaiting")}</Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field id="new-password" label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
              <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" size="lg" loading={busy}>
              {t("auth.setPassword")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
