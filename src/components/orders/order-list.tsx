"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { updateBatchStatus, updateOrderStatus } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useFormat } from "@/lib/i18n/format";
import type { Order, OrderStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/controls";
import { Alert, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { EmptyState } from "@/components/domain/empty-state";
import { nextActions, OrderCard, OrderStatusBadge } from "@/components/domain/orders";

const ACTIVE: OrderStatus[] = ["pooling", "placed", "accepted", "packed", "out_for_delivery"];
type Tab = "active" | "completed" | "all";
type Target = { kind: "order"; order: Order } | { kind: "batch"; batchId: string; orders: Order[] };

/** Tomorrow, 8 pm, as a datetime-local value. */
function defaultDeliverBy() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Accepting promises a delivery time; on-time delivery is what the farmer's trust score counts. */
function AcceptDialog({ open, onClose, onConfirm, busy }: { open: boolean; onClose: () => void; onConfirm: (iso: string) => void; busy: boolean }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultDeliverBy());
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("orders.acceptTitle")} description={t("orders.acceptBody")} closeLabel={t("common.close")}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(new Date(value).toISOString());
          }}
        >
          <Field id="deliver-by" label={t("orders.deliverBy")}>
            <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} required />
          </Field>
          <Button type="submit" size="lg" loading={busy}>
            {t("orders.accept")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A released household trip: one farm, one PIN code, several orders delivered together. */
function TripCard({ orders, onAction, busy, renderFooter }: { orders: Order[]; onAction: (t: Target, s: OrderStatus) => void; busy: boolean; renderFooter?: (o: Order) => React.ReactNode }) {
  const { t } = useTranslation();
  const f = useFormat();
  const batch = orders[0].batch!;
  const statuses = new Set(orders.map((o) => o.status));
  const common = statuses.size === 1 ? orders[0].status : null;
  const actions = common ? nextActions({ status: common }, "farmer", t).filter((a) => a.status !== "cancelled") : [];
  const target: Target = { kind: "batch", batchId: batch.id, orders };
  // What the homes pay together: the trip cost once their savings cover it, less at a cut-off.
  const paid = Math.round(orders.reduce((sum, o) => sum + (o.delivery_fee ?? 0), 0) * 100) / 100;
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-sunken p-3 md:col-span-2">
      <header className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-col">
          <h3 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink">
            <Users className="size-5 text-ink-muted" aria-hidden />
            {t("orders.tripTitle", { pin: batch.pincode, count: orders.length })}
          </h3>
          <p className="text-small text-ink-muted">
            {t("orders.tripMeta", { km: f.number(batch.distance_km ?? 0), load: f.number(batch.load_qty), fee: f.money(paid) })}
          </p>
        </div>
        {common ? <OrderStatusBadge status={common} /> : null}
      </header>
      {batch.below_break_even && common === "placed" ? (
        <Alert tone="warning">{t("orders.belowBreakEven", { paid: f.money(paid), trip: f.money(batch.trip_cost) })}</Alert>
      ) : null}
      {actions.length ? (
        <div className="flex flex-wrap gap-3 px-1">
          {actions.map((a) => (
            <Button
              key={a.status}
              variant={a.tone === "primary" ? "primary" : "secondary"}
              className={a.tone === "danger" ? "text-danger" : undefined}
              disabled={busy}
              onClick={() => onAction(target, a.status)}
            >
              {a.status === "accepted" ? t("orders.acceptTrip") : a.status === "rejected" ? t("orders.rejectTrip") : a.label}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="grid items-start gap-3 md:grid-cols-2">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} perspective="farmer" footer={renderFooter?.(o)} />
        ))}
      </div>
    </section>
  );
}

/**
 * Tabs + order cards for either side. Destructive moves (reject, cancel) ask first; accepting asks
 * for a delivery time. Every move goes through update_order_status / update_batch_status.
 */
export function OrderList({
  orders,
  loading,
  perspective,
  invalidate,
  empty,
  renderFooter,
  header,
}: {
  orders: Order[];
  loading: boolean;
  perspective: "farmer" | "buyer";
  invalidate: readonly (readonly unknown[])[];
  empty: React.ReactNode;
  renderFooter?: (o: Order) => React.ReactNode;
  header?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("active");
  const [busy, setBusy] = useState<{ id: string; status: OrderStatus } | null>(null);
  const [confirm, setConfirm] = useState<{ target: Target; status: OrderStatus } | null>(null);
  const [accepting, setAccepting] = useState<Target | null>(null);

  // Farmers don't act on household orders still pooling; those show as forming trips instead.
  const visible = perspective === "farmer" ? orders.filter((o) => o.status !== "pooling") : orders;
  const inTab = (o: Order, k: Tab) => (k === "all" ? true : k === "active" ? ACTIVE.includes(o.status) : !ACTIVE.includes(o.status));
  const shown = visible.filter((o) => inTab(o, tab));
  const count = (k: Tab) => visible.filter((o) => inTab(o, k)).length;

  async function move(target: Target, status: OrderStatus, deliverBy?: string) {
    const id = target.kind === "order" ? target.order.id : target.batchId;
    setBusy({ id, status });
    try {
      if (target.kind === "order") await updateOrderStatus(target.order.id, status, deliverBy);
      else await updateBatchStatus(target.batchId, status, deliverBy);
      toast.success(t("orders.updated"));
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      setConfirm(null);
      setAccepting(null);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  }

  function act(target: Target, status: OrderStatus) {
    if (status === "accepted") setAccepting(target);
    else if (status === "rejected" || status === "cancelled") setConfirm({ target, status });
    else void move(target, status);
  }

  // Group released household trips (farmer view); everything else stays one card per order.
  const trips = new Map<string, Order[]>();
  const singles: Order[] = [];
  for (const o of shown) {
    if (perspective === "farmer" && o.batch_id && o.batch) trips.set(o.batch_id, [...(trips.get(o.batch_id) ?? []), o]);
    else singles.push(o);
  }

  return (
    <>
      {header}
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
        <EmptyState icon={Inbox} title={t("orders.empty")} body={visible.length === 0 ? empty : undefined} />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2" aria-live="polite">
          {[...trips.values()].map((group) => (
            <TripCard key={group[0].batch_id} orders={group} onAction={act} busy={Boolean(busy)} renderFooter={renderFooter} />
          ))}
          {singles.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              perspective={perspective}
              busyStatus={busy?.id === o.id ? busy.status : null}
              onAction={(s) => act({ kind: "order", order: o }, s)}
              footer={renderFooter?.(o)}
            />
          ))}
        </div>
      )}

      <AcceptDialog open={Boolean(accepting)} onClose={() => setAccepting(null)} busy={Boolean(busy)} onConfirm={(iso) => accepting && void move(accepting, "accepted", iso)} />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.status === "rejected" ? t("orders.rejectTitle") : t("orders.cancelTitle")}
        body={confirm?.status === "rejected" ? t("orders.rejectBody") : t("orders.cancelBody")}
        confirmLabel={confirm?.status === "rejected" ? t("orders.reject") : t("orders.cancel")}
        cancelLabel={t("orders.keep")}
        loading={Boolean(busy)}
        onConfirm={() => confirm && void move(confirm.target, confirm.status)}
      />
    </>
  );
}
