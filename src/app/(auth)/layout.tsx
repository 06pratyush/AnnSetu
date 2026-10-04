"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/domain/brand";
import { LanguageToggle } from "@/components/domain/choices";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="rounded-sm" aria-label="AnnSetu">
          <BrandMark />
        </Link>
        <LanguageToggle />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:pt-10">
        <div className="w-full max-w-xl">{children}</div>
      </main>
      <p className="px-4 pb-6 text-center text-small text-ink-muted">{t("common.tagline")}</p>
    </div>
  );
}
