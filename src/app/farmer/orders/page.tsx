"use client";

import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { keys, useFarmerOrders } from "@/lib/queries";
import { PageHeader } from "@/components/layout/app-shell";
import { OrderList } from "@/components/orders/order-list";

export default function FarmerOrdersPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const orders = useFarmerOrders();
  return (
    <>
      <PageHeader title={t("orders.titleFarmer")} subtitle={t("orders.subtitleFarmer")} />
      <OrderList
        orders={orders.data ?? []}
        loading={orders.isLoading}
        perspective="farmer"
        invalidate={[keys.farmerOrders(profile?.id), keys.myProduce(profile?.id)]}
        empty={t("orders.emptyFarmer")}
      />
    </>
  );
}
