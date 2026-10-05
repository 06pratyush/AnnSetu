"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/lib/errors";
import { isDemo, supabase } from "@/lib/supabase";
import { appUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("errors.email"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl("/reset-password/") });
    setBusy(false);
    if (err) setError(errorMessage(err, t));
    else setSent(true);
  }


  return (
    <Card>
      <CardHeader>
        <h1 className="font-display text-h1 font-bold text-ink">{t("auth.resetTitle")}</h1>
        <p className="text-body text-ink-muted">{t("auth.resetBody")}</p>
      </CardHeader>
      <CardContent>
        {isDemo ? (
          <Alert tone="info">{t("demo.noEmailReset")}</Alert>
        ) : sent ? (
          <Alert tone="success">{t("auth.resetSent", { email: email.trim() })}</Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Field id="email" label={t("common.email")}>
              <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" size="lg" loading={busy}>
              {t("auth.sendResetLink")}
            </Button>
          </form>
        )}
        <Link href="/login" className="mt-4 inline-block text-small font-semibold text-ink underline underline-offset-4">
          {t("common.back")}
        </Link>
      </CardContent>
    </Card>
  );
}
