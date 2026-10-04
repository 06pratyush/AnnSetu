"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SearchX, Sprout, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageSkeleton } from "@/lib/auth/role-guard";
import { useFormat } from "@/lib/i18n/format";
import { useFarmerListings, useFarmerPublic, useFarmerReviews } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState } from "@/components/domain/empty-state";
import { FarmerCard, RatingStars } from "@/components/domain/market";
import { ProduceCard } from "@/components/domain/produce";

function FarmerProfile() {
  const { t } = useTranslation();
  const f = useFormat();
  const id = useSearchParams().get("id");
  const farmer = useFarmerPublic(id);
  const listings = useFarmerListings(id);
  const reviews = useFarmerReviews(id);
  if (farmer.isLoading) return <PageSkeleton />;
  if (!farmer.data) return <EmptyState icon={SearchX} title={t("farmerProfile.notFound")} />;
  const fp = farmer.data;
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <FarmerCard farmer={fp} className="p-6" />
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4 sm:pt-6">
            {fp.farm_size_acres ? <p className="text-body text-ink">{t("farmerProfile.acres", { acres: f.number(fp.farm_size_acres) })}</p> : null}
            {fp.main_crops.length ? (
              <div className="flex flex-col gap-2">
                <p className="text-small font-semibold text-ink-muted">{t("farmerProfile.grows")}</p>
                <div className="flex flex-wrap gap-2">
                  {fp.main_crops.map((c) => (
                    <Badge key={c} tone="role">
                      <Sprout aria-hidden />
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h2 font-semibold text-ink">{t("farmerProfile.onSale")}</h2>
        {listings.isLoading ? (
          <Skeleton className="h-72" />
        ) : !listings.data?.length ? (
          <p className="text-body text-ink-muted">{t("market.empty")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.data.map((l) => (
              <ProduceCard key={l.id} listing={l} href={`/market/product?id=${l.id}`} />
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="size-5 text-ink-muted" aria-hidden />
            {t("farmerProfile.ratings")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!reviews.data?.length ? (
            <p className="text-body text-ink-muted">{t("farmerProfile.noRatings")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {reviews.data.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <RatingStars value={r.rating} size="sm" />
                    <span className="text-small text-ink-muted">
                      {r.reviewer_name} · {f.date(r.created_at, "long")}
                    </span>
                  </div>
                  {r.comment ? <p className="text-body text-ink">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function FarmerProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FarmerProfile />
    </Suspense>
  );
}
