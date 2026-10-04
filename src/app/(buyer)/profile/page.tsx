"use client";

import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { PageSkeleton, RoleGuard } from "@/lib/auth/role-guard";
import { useFormat } from "@/lib/i18n/format";
import { useBuyerOrders, useDefaultAddress, useMyDemand } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/layout/app-shell";
import { StatCard } from "@/components/domain/figures";
import { ProfileForm } from "@/components/forms/profile-form";
import { AvatarUploader } from "@/components/forms/avatar-uploader";

function BuyerProfile() {
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useAuth();
  const address = useDefaultAddress();
  const orders = useBuyerOrders();
  const demand = useMyDemand();
  if (!profile || address.isLoading) return <PageSkeleton />;
  const placed = (orders.data ?? []).filter((o) => o.status !== "cancelled" && o.status !== "rejected");
  const spent = (orders.data ?? []).filter((o) => o.status === "delivered").reduce((s, o) => s + o.total, 0);
  const openReq = (demand.data ?? []).filter((d) => d.status === "open").length;

  return (
    <>
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.memberSince", { date: f.date(profile.created_at, "long") })}
        actions={<Badge tone="role">{t(`roles.${profile.consumer_type ?? "individual"}`)}</Badge>}
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <StatCard label={t("profile.totalOrders")} value={f.number(placed.length)} />
            <StatCard label={t("profile.totalSpent")} value={f.moneyCompact(spent)} hint={t("orders.status.delivered")} />
            <StatCard label={t("profile.openRequests")} value={f.number(openReq)} className="col-span-2 lg:col-span-1" />
          </div>
        </div>
      </div>
    </>
  );
}

export default function BuyerProfilePage() {
  return (
    <RoleGuard role="consumer">
      <BuyerProfile />
    </RoleGuard>
  );
}
