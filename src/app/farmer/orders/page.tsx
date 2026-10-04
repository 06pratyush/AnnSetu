"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { listOpenBatches } from "@/lib/api";
import { keys, useFarmerOrders } from "@/lib/queries";
import { PageHeader } from "@/components/layout/app-shell";
import { BatchProgress } from "@/components/domain/matching";
import { OrderList } from "@/components/orders/order-list";

/** Household orders still pooling: each will reach the farmer as one trip once it pays for itself. */
function FormingTrips() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const batches = useQuery({ queryKey: ["open-batches", profile?.id], queryFn: () => listOpenBatches(profile!.id), enabled: Boolean(profile) });
  if (!batches.data?.length) return null;
  return (
    <section aria-labelledby="forming" className="mb-6 flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h2 id="forming" className="flex items-center gap-2 font-display text-h3 font-semibold text-ink">
        <Users className="size-5 text-ink-muted" aria-hidden />
        {t("orders.formingTitle", { count: batches.data.length })}
      </h2>
      <p className="text-small text-ink-muted">{t("orders.formingBody")}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {batches.data.map((b) => (
          <li key={b.id} className="flex flex-col gap-1.5">
            <p className="text-small font-semibold text-ink">{t("orders.formingTo", { pin: b.pincode })}</p>
            <BatchProgress batch={b} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function FarmerOrdersPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const orders = useFarmerOrders();
  return (
    <>
      <PageHeader title={t("orders.titleFarmer")} subtitle={t("orders.subtitleFarmer")} />
      <OrderList
        header={<FormingTrips />}
        orders={orders.data ?? []}
        loading={orders.isLoading}
        perspective="farmer"
        invalidate={[keys.farmerOrders(profile?.id), keys.myProduce(profile?.id), ["open-batches", profile?.id]]}
        empty={t("orders.emptyFarmer")}
      />
    </>
  );
}
