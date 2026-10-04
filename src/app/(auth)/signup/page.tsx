"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { homeFor, useAuth } from "@/lib/auth/auth-provider";
import { ConfigMissing } from "@/lib/auth/role-guard";
import { errorMessage } from "@/lib/errors";
import { useLang } from "@/lib/i18n/provider";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { appUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { RoleChoiceCards, type AccountChoice } from "@/components/domain/choices";
import { EmptyState } from "@/components/domain/empty-state";

function isChoice(v: string | null): v is AccountChoice {
  return v === "farmer" || v === "individual" || v === "industrial";
}

function SignupForm() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const { status, session, profile } = useAuth();
  const initial = params.get("as");
  const [choice, setChoice] = useState<AccountChoice | null>(isChoice(initial) ? initial : null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready" && session && profile) router.replace(homeFor(profile));
  }, [status, session, profile, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!choice) next.role = t("errors.required");
    if (!name.trim()) next.name = t("errors.required");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("errors.email");
    if (password.length < 8) next.password = t("errors.minLength", { count: 8 });
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: appUrl("/onboarding/"),
        data: {
          role: choice === "farmer" ? "farmer" : "consumer",
          consumer_type: choice === "farmer" ? null : choice,
          full_name: name.trim(),
          preferred_lang: lang,
        },
      },
    });
    setBusy(false);
    if (error) {
      setFormError(errorMessage(error, t));
      return;
    }
    // With "Confirm email" off, Supabase signs the user in straight away.
    if (data.session) router.replace("/onboarding");
    else if (data.user && data.user.identities?.length === 0) setFormError(t("auth.emailTaken"));
    else setSentTo(email.trim());
  }

  if (!isSupabaseConfigured) return <ConfigMissing />;

  if (sentTo) {
    return (
      <EmptyState
        icon={MailCheck}
        title={t("auth.confirmEmailTitle")}
        body={t("auth.confirmEmailBody", { email: sentTo })}
        action={
          <Button asChild variant="secondary">
            <Link href="/login">{t("common.signIn")}</Link>
          </Button>
        }
        className="border-solid bg-surface"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="font-display text-h1 font-bold text-ink">{t("auth.signupTitle")}</h1>
        <p className="text-body text-ink-muted">{t("auth.signupBody")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          {formError ? <Alert tone="danger">{formError}</Alert> : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-small font-semibold text-ink">{t("auth.chooseRole")}</legend>
            <RoleChoiceCards value={choice} onChange={setChoice} className="sm:grid-cols-1" />
            {errors.role ? (
              <p className="text-small text-danger" role="alert">
                {errors.role}
              </p>
            ) : null}
          </fieldset>
          <Field id="name" label={t("auth.fullName")} error={errors.name}>
            <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="email" label={t("common.email")} error={errors.email}>
            <Input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field id="password" label={t("auth.password")} hint={t("auth.passwordHint")} error={errors.password}>
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" loading={busy}>
            {busy ? t("auth.creating") : t("common.signUp")}
          </Button>
          <p className="text-center text-body text-ink-muted">
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
              {t("common.signIn")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
