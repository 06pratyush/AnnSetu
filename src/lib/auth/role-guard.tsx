"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { homeFor, useAuth } from "./auth-provider";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState } from "@/components/domain/empty-state";

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-5 w-80 max-w-full" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/**
 * Client-side gate for signed-in areas: sends visitors to sign in, unfinished profiles to onboarding,
 * and shows a clear message on the wrong side of the bridge. Row-level security is the real boundary.
 */
export function RoleGuard({ role, children, allowUnonboarded = false }: { role?: Role; children: React.ReactNode; allowUnonboarded?: boolean }) {
  const { t } = useTranslation();
  const { status, session, profile, profileError, refreshProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "ready") return;
    if (!session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (profile && !profile.onboarded && !allowUnonboarded) router.replace("/onboarding");
  }, [status, session, profile, allowUnonboarded, pathname, router]);

  if (status === "loading" || !session) return <PageSkeleton />;
  if (!profile) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("errors.generic")}
        body={profileError ? t("errors.network") : undefined}
        action={<Button onClick={() => void refreshProfile()}>{t("common.retry")}</Button>}
      />
    );
  }
  if (!profile.onboarded && !allowUnonboarded) return <PageSkeleton />;
  if (role && profile.role !== role) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("errors.wrongRole", { role: t(`roles.${role}`) })}
        action={
          <Button asChild>
            <Link href={homeFor(profile)}>{t("errors.goToMyHome")}</Link>
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}
