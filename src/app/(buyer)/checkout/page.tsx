"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, CircleCheck, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { PageSkeleton, RoleGuard } from "@/lib/auth/role-guard";
import { placeOrder } from "@/lib/api";
import { cart, useCart } from "@/lib/cart";
import { errorMessage } from "@/lib/errors";
import { keys, useDefaultAddress } from "@/lib/queries";
import type { AddressInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/app-shell";
import { CartSummary } from "@/components/domain/cart";
import { EmptyState } from "@/components/domain/empty-state";
import { EMPTY_ADDRESS, LocationPicker, validateAddress, type AddressErrors } from "@/components/map/location-picker";

function Checkout() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const saved = useDefaultAddress();
  const lines = useCart();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [edited, setAddr] = useState<AddressInput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addrErrors, setAddrErrors] = useState<AddressErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);

  // Start from the saved address; once the buyer edits, their version wins.
  const a = saved.data;
  const addr: AddressInput | null =
    edited ??
    (saved.isLoading
      ? null
      : a
        ? { label: a.label, line1: a.line1, line2: a.line2 ?? "", village_city: a.village_city, district: a.district, state: a.state, pincode: a.pincode, lat: a.lat, lng: a.lng }
        : EMPTY_ADDRESS);

  if (placed !== null) {
    return (
      <EmptyState
        icon={CircleCheck}
        title={t("checkout.success")}
        body={t("checkout.successBody", { count: placed })}
        className="border-solid bg-surface"
        action={
          <Button asChild>
            <Link href="/orders">{t("nav.myOrders")}</Link>
          </Button>
        }
      />
    );
  }
  if (!addr) return <PageSkeleton />;
  if (lines.length === 0) {
    return (
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
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("errors.required");
    const digits = phone.replace(/\D/g, "");
    if (!/^(91)?[6-9]\d{9}$/.test(digits)) next.phone = t("errors.phone");
    const ae = validateAddress(addr!, t);
    setErrors(next);
    setAddrErrors(ae);
    setFormError(null);
    if (Object.keys(next).length || Object.keys(ae).length) {
      setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      const res = await placeOrder(
        lines.map((l) => ({ produce_id: l.produceId, quantity: l.quantity })),
        {
          name: name.trim(),
          phone: digits.slice(-10),
          line1: addr!.line1,
          line2: addr!.line2,
          village_city: addr!.village_city,
          district: addr!.district,
          state: addr!.state,
          pincode: addr!.pincode,
          lat: addr!.lat,
          lng: addr!.lng,
          notes: notes.trim() || null,
        },
      );
      cart.clear();
      setPlaced(res.orders.length);
      void qc.invalidateQueries({ queryKey: keys.buyerOrders(profile?.id) });
      void qc.invalidateQueries({ queryKey: ["market"] });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setFormError(errorMessage(err, t));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("checkout.title")} />
      <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {formError ? (
            <Alert tone="danger" action={<Button asChild variant="secondary" size="sm"><Link href="/cart">{t("nav.cart")}</Link></Button>}>
              {formError}
            </Alert>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>{t("checkout.delivery")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="recipient" label={t("checkout.recipient")} error={errors.name}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </Field>
                <Field id="phone" label={t("common.phone")} error={errors.phone}>
                  <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                </Field>
              </div>
              <LocationPicker value={addr} onChange={setAddr} errors={addrErrors} idPrefix="delivery" />
              <Field id="notes" label={t("checkout.notes")} optional={t("common.optional")}>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("checkout.notesPlaceholder")} maxLength={500} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("checkout.payment")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 rounded-md border-2 border-role bg-role-soft p-4">
                <Banknote className="mt-0.5 size-6 shrink-0 text-role" aria-hidden />
                <div>
                  <p className="text-body font-semibold text-ink">{t("checkout.codTitle")}</p>
                  <p className="text-small text-ink">{t("checkout.codBody")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <CartSummary
          lines={lines}
          className="lg:sticky lg:top-24"
          action={
            <Button type="submit" size="lg" loading={busy}>
              {busy ? t("checkout.placing") : t("checkout.place")}
            </Button>
          }
        />
      </form>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <RoleGuard role="consumer">
      <Checkout />
    </RoleGuard>
  );
}
