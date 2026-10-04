"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { RoleGuard } from "@/lib/auth/role-guard";
import { createReview } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { keys, useBuyerOrders } from "@/lib/queries";
import type { Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/layout/app-shell";
import { RatingStars } from "@/components/domain/market";
import { OrderTimeline } from "@/components/domain/orders";
import { OrderList } from "@/components/orders/order-list";

function ReviewDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  if (!order) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("orders.rate")} description={order.farmer_name} closeLabel={t("common.close")}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!rating) return;
            setBusy(true);
            try {
              await createReview(order.id, rating, comment);
              toast.success(t("orders.rated"));
              await qc.invalidateQueries({ queryKey: keys.buyerOrders(profile?.id) });
              onClose();
            } catch (err) {
              toast.error(errorMessage(err, t));
            } finally {
              setBusy(false);
            }
          }}
        >
          <RatingStars value={rating} onChange={setRating} />
          <Field id="review-comment" label={t("common.notes")} optional={t("common.optional")}>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("orders.reviewPlaceholder")} maxLength={1000} />
          </Field>
          <Button type="submit" size="lg" disabled={!rating} loading={busy}>
            {t("orders.submitReview")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BuyerOrders() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const orders = useBuyerOrders();
  const [reviewing, setReviewing] = useState<Order | null>(null);
  return (
    <>
      <PageHeader title={t("orders.titleBuyer")} subtitle={t("orders.subtitleBuyer")} />
      <OrderList
        orders={orders.data ?? []}
        loading={orders.isLoading}
        perspective="buyer"
        invalidate={[keys.buyerOrders(profile?.id)]}
        empty={
          <span className="flex flex-col items-center gap-3">
            {t("orders.emptyBuyer")}
            <Button asChild>
              <Link href="/market">{t("orders.shopNow")}</Link>
            </Button>
          </span>
        }
        renderFooter={(o) => (
          <div className="flex w-full flex-col gap-4">
            <details className="group">
              <summary className="cursor-pointer text-small font-semibold text-ink underline-offset-4 hover:underline">{t("common.status")}</summary>
              <div className="mt-3">
                <OrderTimeline status={o.status} history={o.status_history} />
              </div>
            </details>
            {o.status === "delivered" ? (
              o.review ? (
                <div className="flex items-center gap-2 text-small text-ink-muted">
                  {t("orders.yourRating")}: <RatingStars value={o.review.rating} size="sm" />
                </div>
              ) : (
                <Button variant="accent" onClick={() => setReviewing(o)} className="self-start">
                  {t("orders.rate")}
                </Button>
              )
            ) : null}
          </div>
        )}
      />
      <ReviewDialog order={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}

export default function BuyerOrdersPage() {
  return (
    <RoleGuard role="consumer">
      <BuyerOrders />
    </RoleGuard>
  );
}
