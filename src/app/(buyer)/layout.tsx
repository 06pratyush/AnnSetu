"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { subscribeToOrders } from "@/lib/api";
import { keys } from "@/lib/queries";
import { AppShell } from "@/components/layout/app-shell";
import { toast } from "@/components/ui/toaster";

/** Buyers hear about status changes on their orders while they browse. */
function useOrderUpdates() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const buyerId = profile?.role === "consumer" ? profile.id : null;
  useEffect(() => {
    if (!buyerId) return;
    return subscribeToOrders({ column: "buyer_id", value: buyerId }, (payload) => {
      if (payload.eventType === "UPDATE" && payload.new.status) {
        toast(`${payload.new.farmer_name ?? ""}: ${t(`orders.status.${payload.new.status}`)}`);
      }
      void qc.invalidateQueries({ queryKey: keys.buyerOrders(buyerId) });
    });
  }, [buyerId, qc, t]);
}

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  useOrderUpdates();
  return <AppShell role="buyer">{children}</AppShell>;
}
