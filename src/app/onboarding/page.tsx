"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { homeFor, useAuth } from "@/lib/auth/auth-provider";
import { PageSkeleton, RoleGuard } from "@/lib/auth/role-guard";
import { getDefaultAddress } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { BrandMark } from "@/components/domain/brand";
import { LanguageToggle } from "@/components/domain/choices";
import { ProfileForm } from "@/components/forms/profile-form";

function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const address = useQuery({ queryKey: ["address", profile?.id], queryFn: () => getDefaultAddress(profile!.id), enabled: Boolean(profile) });
  if (!profile || address.isLoading) return <PageSkeleton />;
  const roleName = profile.role === "farmer" ? t("roles.farmer") : t(`roles.${profile.consumer_type ?? "individual"}`);
  return (
    <div data-role={profile.role === "farmer" ? "farmer" : "buyer"} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="self-start rounded-full bg-role-soft px-3 py-1 text-label font-semibold text-ink">{roleName}</span>
        <h1 className="font-display text-h1 font-bold text-ink sm:text-[2rem]">{t("onboarding.title")}</h1>
        <p className="text-body text-ink-muted">{t("onboarding.subtitle")}</p>
      </div>
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <ProfileForm
            profile={profile}
            address={address.data ?? null}
            submitLabel={t("onboarding.finish")}
            onSaved={() => {
              toast.success(t("onboarding.saved"));
              router.replace(homeFor({ ...profile, onboarded: true }));
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label="AnnSetu" className="rounded-sm">
          <BrandMark />
        </Link>
        <LanguageToggle />
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl px-4 pt-4 pb-24">
        <RoleGuard allowUnonboarded>
          <Onboarding />
        </RoleGuard>
      </main>
    </div>
  );
}
