"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { RoleGuard } from "@/lib/auth/role-guard";
import { subscribeToOrders } from "@/lib/api";
import { keys, useFarmerOrders } from "@/lib/queries";
import { AppShell } from "@/components/layout/app-shell";
import { toast } from "@/components/ui/toaster";

/** Live order alerts for the whole farmer area: a toast on each new order, fresh counts everywhere. */
function useOrderAlerts() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const farmerId = profile?.role === "farmer" ? profile.id : null;
  useEffect(() => {
    if (!farmerId) return;
    return subscribeToOrders({ column: "farmer_id", value: farmerId }, (payload) => {
      if (payload.eventType === "INSERT") toast(t("orders.newOrderToast", { name: payload.new.buyer_name ?? "" }));
      void qc.invalidateQueries({ queryKey: keys.farmerOrders(farmerId) });
      void qc.invalidateQueries({ queryKey: keys.myProduce(farmerId) });
    });
  }, [farmerId, qc, t]);
}

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  useOrderAlerts();
  const orders = useFarmerOrders();
  const pending = (orders.data ?? []).filter((o) => o.status === "placed").length;
  return (
    <AppShell role="farmer" pendingOrders={pending}>
      <RoleGuard role="farmer">{children}</RoleGuard>
    </AppShell>
  );
}
