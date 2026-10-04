"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, CalendarDays, Info, SearchX, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import { PageSkeleton } from "@/lib/auth/role-guard";
import { matchListings } from "@/lib/api";
import { useBuyerContext, useItemName } from "@/lib/matching/hooks";
import { cart, useCart } from "@/lib/cart";
import { useFormat } from "@/lib/i18n/format";
import { useFarmerPublic, useListing } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { EmptyState } from "@/components/domain/empty-state";
import { ProducePhoto } from "@/components/domain/brand";
import { PriceTag, QuantityStepper } from "@/components/domain/figures";
import { FarmerCard } from "@/components/domain/market";
import { OrganicBadge } from "@/components/domain/produce";
import { FreshLine, TrustLine } from "@/components/domain/matching";

function Product() {
  const { t } = useTranslation();
  const f = useFormat();
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { profile } = useAuth();
  const listing = useListing(id);
  const farmer = useFarmerPublic(listing.data?.farmer_id ?? null);
  const buyer = useBuyerContext();
  const itemName = useItemName();
  // The engine's view of this listing for this buyer: distance, freshness on arrival, trip cost.
  const match = useQuery({
    queryKey: ["match-one", listing.data?.item_id, buyer.lat, buyer.lng, buyer.buyerType, buyer.maxKm],
    queryFn: () =>
      matchListings({ itemId: listing.data!.item_id, quantity: null, lat: buyer.lat, lng: buyer.lng, buyerType: buyer.buyerType, maxKm: buyer.maxKm, state: buyer.state, district: buyer.district, category: null, organic: false, limit: 500 }),
    enabled: Boolean(listing.data?.item_id) && buyer.ready,
  });
  const row = match.data?.find((r) => r.id === id) ?? null;
  const qtyParam = Number(params.get("qty"));
  const lines = useCart();
  const inCart = lines.find((l) => l.produceId === id);
  const [photo, setPhoto] = useState(0);
  const [qty, setQty] = useState<number | null>(null);

  if (listing.isLoading) return <PageSkeleton />;
  if (!listing.data) return <EmptyState icon={SearchX} title={t("market.notFound")} action={<Button asChild><Link href="/market">{t("market.back")}</Link></Button>} />;
  const l = listing.data;
  const quantity = qty ?? inCart?.quantity ?? (qtyParam > 0 ? Math.min(Math.max(qtyParam, l.min_order_qty), l.qty_available) : l.min_order_qty);
  const outOfReach = match.isSuccess && buyer.lat !== null && !row && l.status === "active";
  const soldOut = l.status !== "active" || l.qty_available <= 0;
  const own = profile?.id === l.farmer_id;
  const canBuy = !soldOut && !own && profile?.role !== "farmer" && !outOfReach;

  function addToCart() {
    if (!profile) return;
    cart.add({
      produceId: l.id,
      itemId: l.item_id,
      category: l.category,
      farmerId: l.farmer_id,
      farmerName: l.farmer_name,
      name: l.name,
      unit: l.unit,
      price: l.price_per_unit,
      quantity,
      minOrder: l.min_order_qty,
      maxQty: l.qty_available,
      image: l.images[0] ?? null,
    });
    toast.success(t("market.added", { qty: f.number(quantity), unit: f.unit(l.unit), name: l.name }), {
      action: { label: t("nav.cart"), onClick: () => router.push("/cart") },
    });
  }

  return (
    <>
      <Link href="/market" className="mb-4 inline-flex items-center gap-1.5 text-small font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        {t("market.back")}
      </Link>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <ProducePhoto src={l.images[photo]} category={l.category} alt={l.name} iconClassName="size-16" />
          {l.images.length > 1 ? (
            <div className="grid grid-cols-4 gap-2">
              {l.images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`${t("produce.photos")} ${i + 1}`}
                  aria-pressed={photo === i}
                  className={cn("overflow-hidden rounded-md border-2", photo === i ? "border-role" : "border-transparent")}
                >
                  <ProducePhoto src={src} category={l.category} alt="" className="rounded-none" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">{t(`categories.${l.category}`)}</Badge>
              {l.is_organic ? <OrganicBadge /> : null}
              {soldOut ? <Badge tone="neutral">{t("market.soldOut")}</Badge> : null}
            </div>
            <h1 className="font-display text-h1 font-bold text-ink sm:text-[2rem]">
              {itemName(l.item_id, l.name)}
              {l.variety ? <span className="font-body text-h3 font-normal text-ink-muted"> · {l.variety}</span> : null}
            </h1>
            <PriceTag price={l.price_per_unit} unit={l.unit} size="lg" />
            {row ? (
              <div className="flex flex-col gap-1">
                <FreshLine hoursUsed={row.hours_used} shelfLifeHours={row.shelf_life_hours} harvestedAt={row.harvested_at} />
                <TrustLine completed={row.orders_completed} onTime={row.orders_on_time} />
                {row.distance_km !== null ? (
                  <p className="text-small text-ink-muted">
                    {t("matching.kmAway", { km: f.number(row.distance_km, 0) })}
                    {buyer.buyerType === "industrial" && row.trip_cost !== null ? ` · ${t("matching.tripCost", { cost: f.money(row.trip_cost) })}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-md border border-border bg-surface p-4 text-small">
            <div>
              <dt className="text-ink-muted">{t("market.availableLabel")}</dt>
              <dd className="font-display text-h3 font-semibold text-ink">{f.qty(l.qty_available, l.unit)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t("produce.minOrder")}</dt>
              <dd className="font-display text-h3 font-semibold text-ink">{f.qty(l.min_order_qty, l.unit)}</dd>
            </div>
            {l.harvest_date ? (
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 text-ink-muted" aria-hidden />
                <span className="text-ink">{t("market.harvested", { date: f.date(l.harvest_date) })}</span>
              </div>
            ) : null}
            {l.best_before ? (
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 text-ink-muted" aria-hidden />
                <span className="text-ink">{t("market.bestBefore", { date: f.date(l.best_before) })}</span>
              </div>
            ) : null}
          </dl>

          {outOfReach ? <Alert tone="warning">{t("matching.outOfReach")}</Alert> : null}
          {own ? (
            <Alert tone="info">{t("market.ownListing")}</Alert>
          ) : profile?.role === "farmer" ? (
            <Alert tone="info">{t("market.farmerViewing")}</Alert>
          ) : soldOut ? null : !profile ? (
            <Button asChild size="lg">
              <Link href={`/login?next=${encodeURIComponent(`${pathname}?id=${l.id}`)}`}>{t("market.loginToBuy")}</Link>
            </Button>
          ) : null}

          {canBuy && profile ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <QuantityStepper
                id="qty"
                value={quantity}
                onChange={setQty}
                min={l.min_order_qty}
                max={l.qty_available}
                unit={l.unit}
                label={t("cart.quantityOf", { name: l.name, unit: f.unit(l.unit) })}
              />
              <Button size="lg" onClick={addToCart} className="flex-1">
                <ShoppingCart aria-hidden />
                {inCart ? t("market.updateCart") : t("market.addToCart")} · {f.money(quantity * l.price_per_unit)}
              </Button>
            </div>
          ) : null}

          {l.description ? (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink">
                <Info className="size-5 text-ink-muted" aria-hidden />
                {t("market.about")}
              </h2>
              <p className="text-body whitespace-pre-line text-ink">{l.description}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-h3 font-semibold text-ink">{t("market.grownBy")}</h2>
            {farmer.data ? <FarmerCard farmer={farmer.data} href={`/farmer-profile?id=${l.farmer_id}`} /> : null}
          </section>
        </div>
      </div>
    </>
  );
}

export default function ProductPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Product />
    </Suspense>
  );
}
