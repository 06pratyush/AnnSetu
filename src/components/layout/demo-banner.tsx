"use client";

import { useEffect, useSyncExternalStore } from "react";
import { FlaskConical, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isDemo } from "@/lib/supabase";
import { demoDb, getDemoStatus, subscribeDemoStatus } from "@/lib/demo/db";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

/** Says when AnnSetu runs on the in-browser demo database, and how that database is doing. */
export function DemoBanner() {
  const { t } = useTranslation();
  const status = useSyncExternalStore(subscribeDemoStatus, getDemoStatus, () => "idle" as const);

  // Start the demo database once the page is idle, so the first click doesn't wait for it.
  useEffect(() => {
    if (!isDemo) return;
    const id = window.setTimeout(() => void demoDb().catch(() => {}), 1200);
    return () => window.clearTimeout(id);
  }, []);

  if (!isDemo) return null;
  if (status === "busy" || status === "failed") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-center gap-3 bg-danger-soft px-4 py-2 text-small text-danger">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        <span>{t(status === "busy" ? "demo.busy" : "demo.failed")}</span>
        <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
          {t("demo.reload")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-2 bg-haldi-soft px-4 py-1.5 text-center text-small text-haldi-ink" aria-live="polite">
      {status === "loading" ? <Spinner className="size-4 shrink-0" /> : <FlaskConical className="size-4 shrink-0" aria-hidden />}
      <span>{t(status === "loading" ? "demo.loading" : "demo.banner")}</span>
    </div>
  );
}
