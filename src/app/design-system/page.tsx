"use client";

import Link from "next/link";
import { useState } from "react";
import { Inbox, PackagePlus, Plus, Sprout, Tractor, Store, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import tokens from "@/styles/tokens.generated.json";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Switch, Tabs, TabsList, TabsTrigger, Avatar } from "@/components/ui/controls";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, UnitInput } from "@/components/ui/input";
import { Alert, Skeleton } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BrandMark, CATEGORY_ICONS } from "@/components/domain/brand";
import { CartLine, CartSummary } from "@/components/domain/cart";
import { LanguageToggle, RoleChoiceCards, ThemeToggle, type AccountChoice } from "@/components/domain/choices";
import { DemandCard, SuggestionPanel } from "@/components/domain/demand";
import { BatchProgress, HiddenNote, MatchCard } from "@/components/domain/matching";
import { ItemPicker } from "@/components/domain/item-picker";
import { useCatalogue, useEngineSettings } from "@/lib/matching/hooks";
import type { CatalogueItem } from "@/lib/matching/search";
import { EmptyState } from "@/components/domain/empty-state";
import { PriceTag, QuantityStepper, StatCard } from "@/components/domain/figures";
import { CategoryChips, FarmerCard, RatingStars, SearchFilterBar, type MarketSort } from "@/components/domain/market";
import { OrderCard, OrderStatusBadge, OrderTimeline } from "@/components/domain/orders";
import { LedgerEntry, ProduceCard, ProduceRow } from "@/components/domain/produce";
import { StockBar } from "@/components/domain/stock-bar";
import type { CategorySlug, OrderStatus } from "@/lib/types";
import { sampleBatch, sampleCart, sampleFarmer, sampleFarmerDemand, sampleLedger, sampleListing, sampleMatch, sampleOrder, sampleOrderInTransit, sampleProduce, sampleProduce2 } from "@/components/design-system/samples";

const SECTIONS = [
  ["principles", "Principles"],
  ["color", "Color"],
  ["type", "Typography"],
  ["space", "Spacing & radius"],
  ["actions", "Actions & inputs"],
  ["status", "Status & feedback"],
  ["stock", "Stock & figures"],
  ["market", "Market"],
  ["orders", "Orders"],
  ["matching", "Matching"],
  ["demand", "Demand"],
  ["layout", "Identity & layout"],
] as const;

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-border pt-10">
      <h2 id={`${id}-h`} className="font-display text-h1 font-bold text-ink">
        {title}
      </h2>
      {intro ? <p className="mt-1 mb-6 max-w-2xl text-body text-ink-muted">{intro}</p> : <div className="mb-6" />}
      <div className="flex flex-col gap-8">{children}</div>
    </section>
  );
}

function Specimen({ name, note, children, className }: { name: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col">
        <h3 className="font-display text-h3 font-semibold text-ink">{name}</h3>
        {note ? <p className="max-w-2xl text-small text-ink-muted">{note}</p> : null}
      </div>
      <div className={cn("min-w-0 rounded-md border border-border bg-bg p-4 sm:p-6", className)}>{children}</div>
    </div>
  );
}

const COLOR_GROUPS: { title: string; names: string[] }[] = [
  { title: "Neutrals", names: ["bg", "surface", "sunken", "ink", "ink-muted", "border", "border-strong"] },
  { title: "Khet · field green (farmer, primary)", names: ["khet", "khet-hover", "khet-soft", "on-khet"] },
  { title: "Neel · indigo (buyer, focus)", names: ["neel", "neel-hover", "neel-soft", "on-neel", "focus"] },
  { title: "Haldi · turmeric (accent, demand)", names: ["haldi", "haldi-hover", "haldi-soft", "on-haldi", "haldi-ink"] },
  { title: "Status", names: ["success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "on-danger", "info", "info-soft"] },
  { title: "Charts", names: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "stock-track", "chart-grid"] },
];

function Swatch({ name }: { name: string }) {
  const tok = tokens.colors.find((c) => c.name === name);
  if (!tok || typeof tok.value === "string") return null;
  return (
    <li className="flex min-w-0 items-center gap-3">
      <span className="size-12 shrink-0 rounded-md border border-border" style={{ background: `var(--${name})` }} aria-hidden />
      <span className="flex min-w-0 flex-col">
        <code className="text-small font-semibold text-ink">--{name}</code>
        <span className="text-label text-ink-muted tabular-nums">
          {tok.value.light} · {tok.value.dark}
        </span>
        <span className="text-label text-ink-muted">{tok.usage}</span>
      </span>
    </li>
  );
}

export default function DesignSystemPage() {
  const { t } = useTranslation();
  const [role, setRole] = useState<"farmer" | "buyer">("farmer");
  const [qty, setQty] = useState(10);
  const [cat, setCat] = useState<CategorySlug | "all">("all");
  const [sort, setSort] = useState<MarketSort>("newest");
  const [organic, setOrganic] = useState(false);
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<number | null>(4);
  const [choice, setChoice] = useState<AccountChoice | null>("farmer");
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { index } = useCatalogue();
  const engine = useEngineSettings();
  const [pickedItem, setPickedItem] = useState<CatalogueItem | null>(null);
  const statuses: OrderStatus[] = ["placed", "accepted", "packed", "out_for_delivery", "delivered", "rejected", "cancelled"];
  // Specimens show times relative to "now" and in the viewer's time zone, so they render after hydration.
  const hydrated = useHydrated();

  return (
    <div data-role={role} className="min-h-dvh bg-bg">
      <header className="z-40 border-b border-border bg-surface/95 backdrop-blur sm:sticky sm:top-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" aria-label="AnnSetu">
            <BrandMark compact />
          </Link>
          <span className="font-display text-h3 font-semibold text-ink">Design system</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Role colors" className="inline-flex h-10 rounded-full border border-border-strong bg-surface p-0.5">
              {(["farmer", "buyer"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => setRole(r)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full px-3 text-small font-semibold", role === r ? "bg-role text-on-role" : "text-ink hover:bg-sunken")}
                >
                  {r === "farmer" ? <Tractor className="size-4" aria-hidden /> : <Store className="size-4" aria-hidden />}
                  {r === "farmer" ? t("roles.farmer") : t("roles.consumer")}
                </button>
              ))}
            </div>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ol className="sticky top-24 flex flex-col gap-1 text-small">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-sm px-2 py-1.5 text-ink-muted hover:bg-sunken hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main id="main" className="flex min-w-0 flex-col gap-12">
          <div className="flex flex-col gap-3">
            <p className="text-label-caps text-small font-semibold text-haldi-ink">अन्नसेतु · AnnSetu</p>
            <h1 className="font-display text-display font-bold text-ink sm:text-[3.25rem] sm:leading-[1.05]">A bridge with two ends</h1>
            <p className="max-w-2xl text-body-lg text-ink-muted">
              Field green for the farmer&apos;s side, indigo for the buyer&apos;s, turmeric where demand needs attention. Everything here is the live
              component from the app, rendered with example data. Switch role, language and theme above.
            </p>
          </div>

          {hydrated ? (
          <>
          <Section id="principles" title="Principles">
            <ol className="grid gap-4 sm:grid-cols-2">
              {[
                ["Readable in the field", "High contrast, 48px touch targets in the farmer area, an icon and a word on every action, big numbers."],
                ["Bilingual by default", "Both typefaces cover Latin and Devanagari. Hindi gets more line height and no letter-spacing. Layouts allow 35% longer strings."],
                ["Numbers are the product", "Indian digit grouping (₹1,25,000), a unit on every quantity, tabular figures in columns only."],
                ["Never color alone", "Every status pairs its color with an icon and a word. Chart segments also differ in lightness and are named in a legend."],
                ["Light on data", "Two font families, photos compressed to ~150 KB, skeletons that match the layout."],
              ].map(([h, b]) => (
                <li key={h} className="rounded-md border border-border bg-surface p-4">
                  <p className="font-display text-h3 font-semibold text-ink">{h}</p>
                  <p className="text-small text-ink-muted">{b}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="color" title="Color" intro="Every value is a token in src/styles/tokens.css with a light and a dark step. Each text pair is checked at WCAG AA in both themes by npm run check:contrast.">
            {COLOR_GROUPS.map((g) => (
              <div key={g.title} className="flex flex-col gap-3">
                <h3 className="font-display text-h3 font-semibold text-ink">{g.title}</h3>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.names.map((n) => (
                    <Swatch key={n} name={n} />
                  ))}
                </ul>
              </div>
            ))}
          </Section>

          <Section id="type" title="Typography" intro="Anek Devanagari (display, KPI figures) with Mukta (everything else): both from Ek Type, both bilingual.">
            {tokens.typeGroups.map((g) => (
              <div key={g.name} className="flex flex-col gap-4">
                {g.styles.map((s) => (
                  <div key={s.name} className="grid gap-1 border-b border-border pb-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                    <div className="text-small text-ink-muted">
                      <code className="font-semibold text-ink">{s.name}</code>
                      <p>
                        {s.fontSize} / {s.lineHeight} · {s.fontWeight}
                      </p>
                    </div>
                    <p
                      className={cn("min-w-0 text-ink", g.family === "display" ? "font-display" : "font-body", s.name === "kpi" && "wdth-condensed")}
                      style={{ fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight }}
                    >
                      {s.sample}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </Section>

          <Section id="space" title="Spacing & radius" intro="A 4px base. Radius is chosen by role, not applied everywhere.">
            <div className="flex flex-col gap-2">
              {tokens.spacing.map((s) => (
                <div key={s.name} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-4 text-small">
                  <code className="text-ink">{s.name}</code>
                  <span className="flex items-center gap-3">
                    <span className="h-3 rounded-sm bg-role" style={{ width: s.value }} aria-hidden />
                    <span className="text-ink-muted">
                      {s.value} · {s.usage}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              {tokens.radius.map((r) => (
                <div key={r.name} className="flex flex-col gap-2 text-small">
                  <span className="h-16 border-2 border-role bg-role-soft" style={{ borderRadius: r.value }} aria-hidden />
                  <code className="text-ink">{r.name}</code>
                  <span className="text-ink-muted">{r.usage}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="actions" title="Actions & inputs">
            <Specimen name="Button" note="Primary wears the role color. md is 48px, the farmer-area minimum; lg (56px) for the main action on a screen.">
              <div className="flex flex-wrap items-center gap-3">
                <Button>
                  <Plus aria-hidden />
                  {t("produce.add")}
                </Button>
                <Button variant="secondary">{t("common.edit")}</Button>
                <Button variant="outline">{t("suggestions.listThis")}</Button>
                <Button variant="accent">{t("orders.rate")}</Button>
                <Button variant="ghost">{t("common.cancel")}</Button>
                <Button variant="destructive">
                  <Trash2 aria-hidden />
                  {t("common.delete")}
                </Button>
                <Button loading>{t("common.saving")}</Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button size="sm">sm · 40px</Button>
                <Button size="md">md · 48px</Button>
                <Button size="lg">lg · 56px</Button>
              </div>
            </Specimen>
            <Specimen name="Field" note="Label above, then the control, then the hint or the error. The error replaces the hint and is announced.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="ds-name" label={t("produce.name")} hint={t("produce.namePlaceholder")}>
                  <Input defaultValue="Tomato" />
                </Field>
                <Field id="ds-phone" label={t("common.phone")} error={t("errors.phone")}>
                  <Input defaultValue="98765" />
                </Field>
                <Field id="ds-price" label={t("produce.pricePerUnit", { unit: t("units.kg") })}>
                  <UnitInput unit={`₹/${t("units.kg")}`} defaultValue={32} />
                </Field>
                <Field id="ds-cat" label={t("produce.category")}>
                  <NativeSelect defaultValue="vegetables">
                    <option value="vegetables">{t("categories.vegetables")}</option>
                    <option value="fruits">{t("categories.fruits")}</option>
                  </NativeSelect>
                </Field>
              </div>
            </Specimen>
            <Specimen name="Quantity stepper" note="Unit-aware, clamps to the minimum order and the stock available.">
              <QuantityStepper value={qty} onChange={setQty} min={5} max={24} unit="kg" label="Quantity" />
            </Specimen>
            <Specimen name="Checkbox, switch, tabs">
              <div className="flex flex-col gap-4">
                <Checkbox id="ds-organic" label={t("produce.organic")} description={t("produce.organicHint")} defaultChecked />
                <label className="flex items-center gap-3 text-body text-ink">
                  <Switch defaultChecked aria-label={t("market.organicOnly")} />
                  {t("market.organicOnly")}
                </label>
                <Tabs defaultValue="active">
                  <TabsList>
                    <TabsTrigger value="active">{t("orders.tabs.active")}</TabsTrigger>
                    <TabsTrigger value="completed">{t("orders.tabs.completed")}</TabsTrigger>
                    <TabsTrigger value="all">{t("orders.tabs.all")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </Specimen>
            <Specimen name="Role choice" note="Radio cards at sign-up. Each card wears its own side's color.">
              <RoleChoiceCards value={choice} onChange={setChoice} />
            </Specimen>
          </Section>

          <Section id="status" title="Status & feedback">
            <Specimen name="Order status badge" note="Color + icon + word, always.">
              <div className="flex flex-wrap gap-2">
                {statuses.map((s) => (
                  <OrderStatusBadge key={s} status={s} />
                ))}
              </div>
            </Specimen>
            <Specimen name="Alert">
              <div className="flex flex-col gap-3">
                <Alert tone="success">{t("location.filled")}</Alert>
                <Alert tone="warning">{t("location.lookupFailed")}</Alert>
                <Alert tone="danger">{t("checkout.insufficient", { name: "Tomato", qty: "4 kg" })}</Alert>
                <Alert tone="info">{t("market.farmerViewing")}</Alert>
              </div>
            </Specimen>
            <Specimen name="Empty state" note="Every list has one: what's missing, one line of help, one action.">
              <EmptyState icon={Inbox} title={t("orders.empty")} body={t("orders.emptyFarmer")} action={<Button>{t("produce.add")}</Button>} />
            </Specimen>
            <Specimen name="Dialog & confirm" note="Bottom sheet on phones, centered on desktop. Destructive actions confirm first.">
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setDialog(true)}>
                  <PackagePlus aria-hidden />
                  {t("ledger.update")}
                </Button>
                <Button variant="secondary" className="text-danger" onClick={() => setConfirm(true)}>
                  {t("orders.reject")}
                </Button>
              </div>
              <Dialog open={dialog} onOpenChange={setDialog}>
                <DialogContent title={t("ledger.update")} description="Tomato" closeLabel={t("common.close")}>
                  <StockBar name="Tomato" unit="kg" sold={62} reserved={14} available={24} />
                </DialogContent>
              </Dialog>
              <ConfirmDialog
                open={confirm}
                onOpenChange={setConfirm}
                title={t("orders.rejectTitle")}
                body={t("orders.rejectBody")}
                confirmLabel={t("orders.reject")}
                cancelLabel={t("orders.keep")}
                onConfirm={() => setConfirm(false)}
              />
            </Specimen>
            <Specimen name="Skeleton">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
                <Skeleton className="h-24" />
              </div>
            </Specimen>
          </Section>

          <Section id="stock" title="Stock & figures" intro="The stock bar is the signature: sold, reserved and unsold, told apart by lightness, 2px gaps and a named legend.">
            <Specimen name="Stock bar">
              <div className="flex flex-col gap-6">
                <StockBar name="Tomato" unit="kg" sold={62} reserved={14} available={24} />
                <StockBar name="Wheat" unit="quintal" sold={12} reserved={4} available={23} spoiled={1} />
                <StockBar name="Tomato" unit="kg" sold={62} reserved={14} available={24} size="sm" />
              </div>
            </Specimen>
            <Specimen name="Stat card & price tag" note="Display sans, proportional figures; the haldi dot marks a figure that needs action.">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label={t("dashboard.revenue")} value="₹1.2L" hint={t("dashboard.revenueHint")} />
                <StatCard label={t("dashboard.unsoldValue")} value="₹61,750" hint={t("dashboard.unsoldHint")} />
                <StatCard label={t("dashboard.pendingOrders")} value="3" hint={`${t("orders.status.placed")}: 1`} attention />
                <StatCard label={t("dashboard.activeListings")} value="5" hint={t("dashboard.activeHint", { count: 1 })} />
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-6">
                <PriceTag price={32} unit="kg" size="sm" />
                <PriceTag price={32} unit="kg" />
                <PriceTag price={2650} unit="quintal" size="lg" />
              </div>
            </Specimen>
            <Specimen name="Produce row" note="The farmer's own listing with its stock and actions.">
              <div className="flex flex-col gap-3">
                <ProduceRow produce={sampleProduce} editHref="#" logHref="#" onUpdateStock={() => setDialog(true)} onSetStatus={() => undefined} />
                <ProduceRow produce={sampleProduce2} editHref="#" logHref="#" onUpdateStock={() => setDialog(true)} onSetStatus={() => undefined} />
              </div>
            </Specimen>
            <Specimen name="Stock log entry" note="The sign shows the effect on unsold stock.">
              <ol className="divide-y divide-border">
                {sampleLedger.map((e) => (
                  <LedgerEntry key={e.id} entry={e} unit="kg" />
                ))}
              </ol>
            </Specimen>
          </Section>

          <Section id="market" title="Market">
            <Specimen name="Search, filters, categories">
              <div className="flex flex-col gap-4">
                <SearchFilterBar query={search} onQuery={setSearch} sort={sort} onSort={setSort} organic={organic} onOrganic={setOrganic} />
                <CategoryChips value={cat} onChange={setCat} />
              </div>
            </Specimen>
            <Specimen name="Produce card" note="One link per card. No photo? The category icon on a sunken tile.">
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <ProduceCard listing={sampleListing} href="#" />
                <ProduceCard listing={{ ...sampleListing, id: "x", category: "grains", name: "Wheat", variety: "Sharbati", unit: "quintal", price_per_unit: 2650, qty_available: 23, is_organic: false, farmer_name: "Gurpreet Singh", district: "Ludhiana", farmer_rating: null }} href="#" />
              </div>
            </Specimen>
            <Specimen name="Farmer card & rating">
              <div className="flex flex-col gap-4">
                <FarmerCard farmer={sampleFarmer} />
                <RatingStars value={rating} onChange={setRating} />
              </div>
            </Specimen>
            <Specimen name="Cart line & summary" note="A cart with two farmers becomes two orders, and says so.">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <ul className="divide-y divide-border rounded-md border border-border bg-surface px-4">
                  {sampleCart.map((l) => (
                    <CartLine key={l.produceId} line={l} onQuantity={() => undefined} onRemove={() => undefined} />
                  ))}
                </ul>
                <CartSummary lines={sampleCart} action={<Button size="lg">{t("checkout.place")}</Button>} />
              </div>
            </Specimen>
          </Section>

          <Section id="orders" title="Orders">
            <Specimen name="Order card" note="New orders get a haldi outline. The next step is the primary button.">
              <div className="grid items-start gap-4 md:grid-cols-2">
                <OrderCard order={sampleOrder} perspective="farmer" onAction={() => undefined} />
                <OrderCard order={sampleOrderInTransit} perspective="buyer" onAction={() => undefined} />
              </div>
            </Specimen>
            <Specimen name="Order timeline">
              <div className="grid gap-6 sm:grid-cols-2">
                <OrderTimeline status="out_for_delivery" history={sampleOrderInTransit.status_history} />
                <OrderTimeline status="rejected" history={[...sampleOrder.status_history, { status: "rejected", at: new Date().toISOString(), by: "farmer" }]} />
              </div>
            </Specimen>
          </Section>

          <Section id="matching" title="Matching" intro="The five algorithms, made visible: search turns any spelling into a catalogue item, hard rules hide what can't serve the buyer, the score orders the rest, stock is live, and household orders share one trip.">
            <Specimen name="Item picker" note="Step 1. Type tamatr, tomatoe or टमाटर. Near matches are offered, never applied silently.">
              <div className="max-w-md">
                <ItemPicker index={index} value={pickedItem} onChange={setPickedItem} placeholder={t("produce.namePlaceholder")} />
              </div>
            </Specimen>
            <Specimen name="Match card" note="Steps 2-4: a listing that passed every hard rule, with distance, freshness on arrival, trust and the trip cost. Why first? opens the score.">
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <MatchCard row={sampleMatch} href="#" name="Tomato" quantity={60} pooled={false} weights={engine.wBusiness} />
                <MatchCard row={{ ...sampleMatch, id: "m2", orders_completed: 0, orders_on_time: 0, part_trust: 0.8, distance_km: 6, trip_cost: 156, farmer_name: "Sunita Devi", farmer_verified: false }} href="#" name="Tomato" quantity={null} pooled weights={engine.wHousehold} />
              </div>
            </Specimen>
            <Specimen name="Hidden note" note="What the hard rules removed, so an empty or short list explains itself.">
              <HiddenNote hidden={[{ reason: "too_far", listings: 2 }, { reason: "not_fresh_on_arrival", listings: 1 }]} />
            </Specimen>
            <Specimen name="Batch progress" note="Household orders pool into one trip; the bar is the households' savings against the trip cost.">
              <div className="flex max-w-md flex-col gap-6">
                <BatchProgress batch={sampleBatch} />
                <BatchProgress batch={{ ...sampleBatch, status: "released", room: 543.6 }} />
              </div>
            </Specimen>
          </Section>

          <Section id="demand" title="Demand" intro="Open buyer requests mapped to this farm: the ones it can reach and already has stock for come first.">
            <Specimen name="Demand card">
              <div className="flex flex-col gap-3">
                <DemandCard demand={sampleFarmerDemand[0]} listHref="#" />
                <DemandCard demand={sampleFarmerDemand[1]} listHref="#" />
              </div>
            </Specimen>
            <Specimen name="Suggestion panel">
              <SuggestionPanel demand={sampleFarmerDemand} listHref={() => "#"} />
            </Specimen>
          </Section>

          <Section id="layout" title="Identity & layout">
            <Specimen name="Wordmark" note="No logo exists yet: the name set in Anek 700 with its Devanagari twin and a two-color bridge arc.">
              <div className="flex flex-wrap items-center gap-8">
                <BrandMark />
                <BrandMark compact />
              </div>
            </Specimen>
            <Specimen name="Category icons" note="lucide-react, 24px default, 20px in dense rows.">
              <ul className="flex flex-wrap gap-4">
                {Object.entries(CATEGORY_ICONS).map(([slug, Icon]) => (
                  <li key={slug} className="flex w-24 flex-col items-center gap-2 text-center text-small text-ink">
                    <span className="flex size-12 items-center justify-center rounded-full bg-sunken">
                      <Icon className="size-6 text-ink-muted" aria-hidden />
                    </span>
                    {t(`categories.${slug}`)}
                  </li>
                ))}
              </ul>
            </Specimen>
            <Specimen name="Avatar, badge, table">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name="Ramesh Patil" size={48} />
                  <Avatar name="Anita Rao" size={36} />
                  <Badge tone="role">
                    <Sprout aria-hidden />
                    Tomato
                  </Badge>
                  <Badge tone="accent">{t("suggestions.panelTitle")}</Badge>
                </div>
                <Table>
                  <THead>
                    <TR>
                      <TH>{t("produce.name")}</TH>
                      <TH className="text-right">{t("produce.sold")}</TH>
                      <TH className="text-right">{t("produce.available")}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    <TR>
                      <TD className="font-semibold">Tomato</TD>
                      <TD numeric>62 kg</TD>
                      <TD numeric>24 kg</TD>
                    </TR>
                    <TR>
                      <TD className="font-semibold">Wheat</TD>
                      <TD numeric>12 quintal</TD>
                      <TD numeric>23 quintal</TD>
                    </TR>
                  </TBody>
                </Table>
              </div>
            </Specimen>
            <Card>
              <CardHeader>
                <CardTitle>App shell</CardTitle>
                <CardDescription>
                  Phones: top bar plus a five-item bottom tab bar. Desktop: a left sidebar for farmers, a top navigation bar for buyers. The data-role
                  attribute on the shell switches every --role token below it.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild variant="secondary">
                  <Link href="/farmer">{t("nav.farmerArea")}</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/market">{t("nav.buyerArea")}</Link>
                </Button>
              </CardContent>
            </Card>
          </Section>
          </>
          ) : (
            <Skeleton className="h-96" />
          )}
        </main>
      </div>
    </div>
  );
}
