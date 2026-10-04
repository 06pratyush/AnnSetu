"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { updateOrderStatus } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import type { Order, OrderStatus } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { EmptyState } from "@/components/domain/empty-state";
import { OrderCard } from "@/components/domain/orders";

const ACTIVE: OrderStatus[] = ["placed", "accepted", "packed", "out_for_delivery"];
type Tab = "active" | "completed" | "all";

/**
 * Tabs + order cards for either side. Destructive moves (reject, cancel) ask first;
 * every move goes through update_order_status, which also fixes up the stock.
 */
export function OrderList({
  orders,
  loading,
  perspective,
  invalidate,
  empty,
  renderFooter,
}: {
  orders: Order[];
  loading: boolean;
  perspective: "farmer" | "buyer";
  invalidate: readonly (readonly unknown[])[];
  empty: React.ReactNode;
  renderFooter?: (o: Order) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("active");
  const [busy, setBusy] = useState<{ id: string; status: OrderStatus } | null>(null);
  const [confirm, setConfirm] = useState<{ order: Order; status: OrderStatus } | null>(null);

  const shown = orders.filter((o) => (tab === "all" ? true : tab === "active" ? ACTIVE.includes(o.status) : !ACTIVE.includes(o.status)));
  const count = (k: Tab) => orders.filter((o) => (k === "all" ? true : k === "active" ? ACTIVE.includes(o.status) : !ACTIVE.includes(o.status))).length;

  async function move(order: Order, status: OrderStatus) {
    setBusy({ id: order.id, status });
    try {
      await updateOrderStatus(order.id, status);
      toast.success(t("orders.updated"));
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      setConfirm(null);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-4">
        <TabsList>
          {(["active", "completed", "all"] as Tab[]).map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`orders.tabs.${k}`)}
              <span className="rounded-full bg-sunken px-2 text-label text-ink-muted tabular-nums">{count(k)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon={Inbox} title={t("orders.empty")} body={orders.length === 0 ? empty : undefined} />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2" aria-live="polite">
          {shown.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              perspective={perspective}
              busyStatus={busy?.id === o.id ? busy.status : null}
              onAction={(s) => (s === "rejected" || s === "cancelled" ? setConfirm({ order: o, status: s }) : void move(o, s))}
              footer={renderFooter?.(o)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.status === "rejected" ? t("orders.rejectTitle") : t("orders.cancelTitle")}
        body={confirm?.status === "rejected" ? t("orders.rejectBody") : t("orders.cancelBody")}
        confirmLabel={confirm?.status === "rejected" ? t("orders.reject") : t("orders.cancel")}
        cancelLabel={t("orders.keep")}
        loading={Boolean(busy)}
        onConfirm={() => confirm && void move(confirm.order, confirm.status)}
      />
    </>
  );
}
