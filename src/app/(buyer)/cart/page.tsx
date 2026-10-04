"use client";

import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { cart, useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/app-shell";
import { CartLine, CartSummary } from "@/components/domain/cart";
import { EmptyState } from "@/components/domain/empty-state";

export default function CartPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const lines = useCart();

  const byFarmer = new Map<string, typeof lines>();
  for (const l of lines) byFarmer.set(l.farmerId, [...(byFarmer.get(l.farmerId) ?? []), l]);

  return (
    <>
      <PageHeader title={t("cart.title")} subtitle={lines.length ? t("cart.items", { count: lines.length }) : undefined} />
      {profile?.role === "farmer" ? (
        <Alert tone="info" className="mb-4">
          {t("market.farmerViewing")}
        </Alert>
      ) : null}
      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={t("cart.empty")}
          body={t("cart.emptyBody")}
          action={
            <Button asChild>
              <Link href="/market">{t("orders.shopNow")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            {[...byFarmer.entries()].map(([farmerId, group]) => (
              <section key={farmerId} className="rounded-md border border-border bg-surface px-4">
                <h2 className="border-b border-border py-3 font-display text-h3 font-semibold text-ink">{t("cart.from", { name: group[0].farmerName })}</h2>
                <ul className="divide-y divide-border">
                  {group.map((l) => (
                    <CartLine key={l.produceId} line={l} onQuantity={(q) => cart.setQuantity(l.produceId, q)} onRemove={() => cart.remove(l.produceId)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <CartSummary
            lines={lines}
            className="lg:sticky lg:top-24"
            action={
              profile?.role === "farmer" ? null : (
                <Button asChild size="lg">
                  <Link href={profile ? "/checkout" : "/login?next=%2Fcheckout"}>
                    {profile ? t("cart.checkout") : t("market.loginToBuy")}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              )
            }
          />
        </div>
      )}
    </>
  );
}
