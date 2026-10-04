"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { PageSkeleton } from "@/lib/auth/role-guard";
import { useFormat } from "@/lib/i18n/format";
import { useDefaultAddress, useFarmerOrders, useFarmerPublic } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard } from "@/components/domain/figures";
import { RatingStars } from "@/components/domain/market";
import { ProfileForm } from "@/components/forms/profile-form";
import { AvatarUploader } from "@/components/forms/avatar-uploader";

export default function FarmerProfilePage() {
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useAuth();
  const address = useDefaultAddress();
  const pub = useFarmerPublic(profile?.id ?? null);
  const orders = useFarmerOrders();
  if (!profile || address.isLoading) return <PageSkeleton />;
  const delivered = (orders.data ?? []).filter((o) => o.status === "delivered").length;

  return (
    <>
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.memberSince", { date: f.date(profile.created_at, "long") })}
        actions={
          <Button asChild variant="secondary">
            <Link href={`/farmer-profile?id=${profile.id}`}>
              <ExternalLink aria-hidden />
              {t("profile.publicPage")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="order-2 lg:order-1">
          <CardContent className="pt-4 sm:pt-6">
            <ProfileForm profile={profile} address={address.data ?? null} submitLabel={t("common.save")} onSaved={() => toast.success(t("profile.saved"))} insideShell />
          </CardContent>
        </Card>
        <div className="order-1 flex flex-col gap-4 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.photo")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AvatarUploader />
            </CardContent>
          </Card>
          <StatCard label={t("profile.avgRating")} value={pub.data?.avg_rating ? pub.data.avg_rating.toFixed(1) : "—"} hint={t("profile.ratingsCount", { count: pub.data?.ratings_count ?? 0 })} />
          {pub.data?.avg_rating ? <RatingStars value={pub.data.avg_rating} /> : null}
          <StatCard label={t("orders.status.delivered")} value={f.number(delivered)} />
        </div>
      </div>
    </>
  );
}
