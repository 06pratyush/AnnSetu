"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/domain/brand";
import { EmptyState } from "@/components/domain/empty-state";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center gap-10 bg-bg px-4 py-10">
      <Link href="/" aria-label="AnnSetu">
        <BrandMark />
      </Link>
      <EmptyState
        icon={SearchX}
        title={t("errors.notFound")}
        body={t("errors.notFoundBody")}
        className="w-full max-w-lg border-solid bg-surface"
        action={
          <Button asChild>
            <Link href="/">{t("errors.goHome")}</Link>
          </Button>
        }
      />
    </div>
  );
}
