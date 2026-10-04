"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { uploadPhoto, type ProduceInput } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useFormat } from "@/lib/i18n/format";
import { useCatalogue, useEngineSettings } from "@/lib/matching/hooks";
import type { CatalogueItem } from "@/lib/matching/search";
import { unitsFor } from "@/lib/matching/units";
import { useDefaultAddress } from "@/lib/queries";
import type { CategorySlug, Produce, Unit } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Field, FieldSet } from "@/components/ui/field";
import { Input, NativeSelect, Textarea, UnitInput } from "@/components/ui/input";
import { Alert, Separator } from "@/components/ui/misc";
import { ItemPicker } from "@/components/domain/item-picker";
import { PhotoUploader, type PhotoItem } from "@/components/domain/photo-uploader";
import { RateSuggestion } from "./rate-suggestion";

export type ProduceDraft = { itemId?: string | null; unit?: Unit };

/** datetime-local value for a moment, in the browser's time zone. */
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/**
 * Create or edit a listing. The item comes from the catalogue (it fixes the category, the units
 * and the shelf life the engine uses). On edit the quantity is not a field: stock changes go
 * through the stock log so every kilo stays accounted for.
 */
export function ProduceForm({
  initial,
  draft,
  submitLabel,
  onSubmit,
}: {
  initial?: Produce;
  draft?: ProduceDraft;
  submitLabel: string;
  onSubmit: (input: ProduceInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const { profile } = useAuth();
  const { index, byId } = useCatalogue();
  const settings = useEngineSettings();
  const address = useDefaultAddress();
  const editing = Boolean(initial);
  const locked = Boolean(initial && (initial.qty_sold > 0 || initial.qty_reserved > 0));

  const [item, setItem] = useState<CatalogueItem | null>(byId.get(initial?.item_id ?? draft?.itemId ?? "") ?? null);
  const [variety, setVariety] = useState(initial?.variety ?? "");
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? draft?.unit ?? "kg");
  const [price, setPrice] = useState(initial ? String(initial.price_per_unit) : "");
  const [qty, setQty] = useState("");
  const [minOrder, setMinOrder] = useState(initial ? String(initial.min_order_qty) : "1");
  const [harvested, setHarvested] = useState(localInput(initial ? new Date(initial.harvested_at) : new Date()));
  const [radius, setRadius] = useState(initial?.delivery_radius_km ? String(initial.delivery_radius_km) : "");
  const [organic, setOrganic] = useState(initial?.is_organic ?? false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [photos, setPhotos] = useState<PhotoItem[]>((initial?.images ?? []).map((url) => ({ key: url, url })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const allowed = item ? unitsFor(item.baseUnit) : (["kg", "quintal", "tonne"] as Unit[]);
  const unitOk = allowed.includes(unit) ? unit : allowed[0];
  const unitLabel = f.unit(unitOk);
  const farmRadius = profile?.farmer_details?.delivery_radius_km ?? settings.farmerRadiusKm;
  const radiusKm = Number(radius) > 0 ? Number(radius) : farmRadius;
  const harvestedIso = harvested ? new Date(harvested).toISOString() : new Date().toISOString();
  const freshUntil = item ? new Date(new Date(harvestedIso).getTime() + item.shelfLifeHours * settings.freshnessLimit * 3600_000) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const priceN = Number(price);
    const qtyN = Number(qty);
    const minN = Number(minOrder);
    if (!item) next.item = t("errors.required");
    if (!price || Number.isNaN(priceN) || priceN <= 0) next.price = t("errors.positive");
    if (!editing && (!qty || Number.isNaN(qtyN) || qtyN <= 0)) next.qty = t("errors.positive");
    if (!minOrder || Number.isNaN(minN) || minN <= 0) next.minOrder = t("errors.positive");
    else if (!editing && !next.qty && minN > qtyN) next.minOrder = t("errors.minOrderTooBig");
    else if (editing && initial && minN > initial.qty_listed) next.minOrder = t("errors.minOrderTooBig");
    if (!harvested || new Date(harvested).getTime() > Date.now() + 60_000) next.harvested = t("errors.harvestFuture");
    if (radius && (Number.isNaN(Number(radius)) || Number(radius) <= 0)) next.radius = t("errors.positive");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length || !item) {
      setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
      return;
    }

    setBusy(true);
    try {
      let images = photos.filter((p) => !p.file).map((p) => p.url);
      const fresh = photos.filter((p) => p.file);
      if (fresh.length && profile) {
        setUploading(true);
        const urls = await Promise.all(fresh.map((p) => uploadPhoto("produce", profile.id, p.file!)));
        images = photos.map((p) => (p.file ? urls[fresh.indexOf(p)] : p.url));
        setUploading(false);
      }
      await onSubmit({
        item_id: item.id,
        harvested_at: harvestedIso,
        delivery_radius_km: radius ? Number(radius) : null,
        category: item.category as CategorySlug,
        name: item.nameEn,
        variety: variety.trim() || null,
        description: description.trim() || null,
        unit: unitOk,
        price_per_unit: priceN,
        qty_listed: editing ? initial!.qty_listed : qtyN,
        min_order_qty: minN,
        harvest_date: harvestedIso.slice(0, 10),
        best_before: null,
        is_organic: organic,
        images,
      });
    } catch (err) {
      setFormError(errorMessage(err, t));
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <FieldSet legend={t("produce.about")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-item" label={t("produce.name")} hint={locked ? t("produce.itemLocked") : t("produce.itemHint")} error={errors.item} className="sm:col-span-2">
            {locked ? (
              <Input value={item ? `${item.nameEn} · ${item.nameHi}` : ""} disabled readOnly />
            ) : (
              <ItemPicker index={index} value={item} onChange={setItem} placeholder={t("produce.namePlaceholder")} cutoff={settings.searchCutoff} />
            )}
          </Field>
          <Field id="p-variety" label={t("produce.variety")} optional={t("common.optional")}>
            <Input value={variety} onChange={(e) => setVariety(e.target.value)} placeholder={t("produce.varietyPlaceholder")} maxLength={80} />
          </Field>
          <Field id="p-unit" label={t("produce.unit")} hint={locked ? t("produce.unitLocked") : undefined}>
            <NativeSelect value={unitOk} onChange={(e) => setUnit(e.target.value as Unit)} disabled={locked}>
              {allowed.map((u) => (
                <option key={u} value={u}>
                  {t(`unitsLong.${u}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FieldSet>

      <Separator />

      <FieldSet legend={t("produce.pricing")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {editing ? null : (
            <Field id="p-qty" label={t("produce.quantity")} error={errors.qty}>
              <UnitInput unit={unitLabel} value={qty} onChange={(e) => setQty(e.target.value)} min={0} step="any" />
            </Field>
          )}
          <Field id="p-min" label={t("produce.minOrder")} hint={t("produce.minOrderHint")} error={errors.minOrder}>
            <UnitInput unit={unitLabel} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} min={0} step="any" />
          </Field>
          <Field id="p-radius" label={t("produce.radius")} optional={t("common.optional")} hint={t("produce.radiusHint", { km: f.number(farmRadius) })} error={errors.radius}>
            <UnitInput unit="km" value={radius} placeholder={String(farmRadius)} onChange={(e) => setRadius(e.target.value)} min={0} step="any" />
          </Field>
          <Field id="p-price" label={t("produce.pricePerUnit", { unit: unitLabel })} hint={t("produce.priceHint", { unit: unitLabel })} error={errors.price}>
            <UnitInput unit={`₹/${unitLabel}`} value={price} onChange={(e) => setPrice(e.target.value)} min={0} step="any" />
          </Field>
        </div>
        {item ? (
          <RateSuggestion
            item={item}
            unit={unitOk}
            farm={{ lat: address.data?.lat ?? null, lng: address.data?.lng ?? null, state: address.data?.state ?? null, district: address.data?.district ?? null }}
            radiusKm={radiusKm}
            listedQty={editing ? initial!.qty_listed : Number(qty) || null}
            harvestedAt={harvestedIso}
            onUse={(p) => setPrice(String(p))}
          />
        ) : null}
      </FieldSet>

      <Separator />

      <FieldSet legend={t("produce.freshness")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="p-harvested"
            label={t("produce.harvestedAt")}
            hint={freshUntil ? t("produce.freshUntil", { when: f.dateTime(freshUntil) }) : undefined}
            error={errors.harvested}
          >
            <Input type="datetime-local" value={harvested} max={localInput(new Date())} onChange={(e) => setHarvested(e.target.value)} />
          </Field>
        </div>
        <Checkbox id="p-organic" label={t("produce.organic")} description={t("produce.organicHint")} checked={organic} onCheckedChange={(v) => setOrganic(v === true)} />
        <PhotoUploader items={photos} onChange={setPhotos} disabled={busy} />
        <Field id="p-desc" label={t("produce.description")} optional={t("common.optional")}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("produce.descriptionPlaceholder")} maxLength={2000} />
        </Field>
      </FieldSet>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] z-20 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
          {uploading ? t("produce.uploading") : busy ? t("common.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
