"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { uploadPhoto, type ProduceInput } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useFormat } from "@/lib/i18n/format";
import { CATEGORY_SLUGS, type CategorySlug, type Produce, type Unit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Field, FieldSet } from "@/components/ui/field";
import { Input, NativeSelect, Textarea, UnitInput } from "@/components/ui/input";
import { Alert, Separator } from "@/components/ui/misc";
import { UnitSelect } from "@/components/domain/figures";
import { PhotoUploader, type PhotoItem } from "@/components/domain/photo-uploader";

export type ProduceDraft = Partial<Pick<Produce, "name" | "category" | "unit" | "variety">>;

/**
 * Create or edit a listing. On edit the quantity is not a field: stock changes go through the
 * stock log so every kilo stays accounted for.
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
  const editing = Boolean(initial);
  const unitLocked = Boolean(initial && (initial.qty_sold > 0 || initial.qty_reserved > 0));

  const [name, setName] = useState(initial?.name ?? draft?.name ?? "");
  const [variety, setVariety] = useState(initial?.variety ?? draft?.variety ?? "");
  const [category, setCategory] = useState<CategorySlug>(initial?.category ?? draft?.category ?? "vegetables");
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? draft?.unit ?? "kg");
  const [price, setPrice] = useState(initial ? String(initial.price_per_unit) : "");
  const [qty, setQty] = useState("");
  const [minOrder, setMinOrder] = useState(initial ? String(initial.min_order_qty) : "1");
  const [harvest, setHarvest] = useState(initial?.harvest_date ?? "");
  const [bestBefore, setBestBefore] = useState(initial?.best_before ?? "");
  const [organic, setOrganic] = useState(initial?.is_organic ?? false);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [photos, setPhotos] = useState<PhotoItem[]>((initial?.images ?? []).map((url) => ({ key: url, url })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const unitLabel = f.unit(unit);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const priceN = Number(price);
    const qtyN = Number(qty);
    const minN = Number(minOrder);
    if (!name.trim()) next.name = t("errors.required");
    if (!price || Number.isNaN(priceN) || priceN <= 0) next.price = t("errors.positive");
    if (!editing && (!qty || Number.isNaN(qtyN) || qtyN <= 0)) next.qty = t("errors.positive");
    if (!minOrder || Number.isNaN(minN) || minN <= 0) next.minOrder = t("errors.positive");
    else if (!editing && !next.qty && minN > qtyN) next.minOrder = t("errors.minOrderTooBig");
    else if (editing && initial && minN > initial.qty_listed) next.minOrder = t("errors.minOrderTooBig");
    if (harvest && bestBefore && bestBefore < harvest) next.bestBefore = t("errors.dateOrder");
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) {
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
        category,
        name: name.trim(),
        variety: variety.trim() || null,
        description: description.trim() || null,
        unit,
        price_per_unit: priceN,
        qty_listed: editing ? initial!.qty_listed : qtyN,
        min_order_qty: minN,
        harvest_date: harvest || null,
        best_before: bestBefore || null,
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
          <Field id="p-name" label={t("produce.name")} error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("produce.namePlaceholder")} maxLength={80} className="text-body-lg" />
          </Field>
          <Field id="p-variety" label={t("produce.variety")} optional={t("common.optional")}>
            <Input value={variety} onChange={(e) => setVariety(e.target.value)} placeholder={t("produce.varietyPlaceholder")} maxLength={80} />
          </Field>
          <Field id="p-category" label={t("produce.category")}>
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value as CategorySlug)}>
              {CATEGORY_SLUGS.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="p-unit" label={t("produce.unit")} hint={unitLocked ? t("produce.unitLocked") : undefined}>
            <UnitSelect value={unit} onChange={(e) => setUnit(e.target.value as Unit)} disabled={unitLocked} />
          </Field>
        </div>
      </FieldSet>

      <Separator />

      <FieldSet legend={t("produce.pricing")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-price" label={t("produce.pricePerUnit", { unit: unitLabel })} hint={t("produce.priceHint", { unit: unitLabel })} error={errors.price}>
            <UnitInput unit={`₹/${unitLabel}`} value={price} onChange={(e) => setPrice(e.target.value)} min={0} step="any" />
          </Field>
          {editing ? null : (
            <Field id="p-qty" label={t("produce.quantity")} error={errors.qty}>
              <UnitInput unit={unitLabel} value={qty} onChange={(e) => setQty(e.target.value)} min={0} step="any" />
            </Field>
          )}
          <Field id="p-min" label={t("produce.minOrder")} hint={t("produce.minOrderHint")} error={errors.minOrder}>
            <UnitInput unit={unitLabel} value={minOrder} onChange={(e) => setMinOrder(e.target.value)} min={0} step="any" />
          </Field>
        </div>
      </FieldSet>

      <Separator />

      <FieldSet legend={t("produce.freshness")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-harvest" label={t("produce.harvestDate")} optional={t("common.optional")}>
            <Input type="date" value={harvest} onChange={(e) => setHarvest(e.target.value)} />
          </Field>
          <Field id="p-best" label={t("produce.bestBefore")} optional={t("common.optional")} error={errors.bestBefore}>
            <Input type="date" value={bestBefore} onChange={(e) => setBestBefore(e.target.value)} min={harvest || undefined} />
          </Field>
        </div>
        <Checkbox id="p-organic" label={t("produce.organic")} description={t("produce.organicHint")} checked={organic} onCheckedChange={(v) => setOrganic(v === true)} />
      </FieldSet>

      <Separator />

      <FieldSet legend={t("produce.photos")} description={t("produce.photosHint")}>
        <PhotoUploader items={photos} onChange={setPhotos} disabled={busy} />
        <Field id="p-desc" label={t("produce.description")} optional={t("common.optional")}>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("produce.descriptionPlaceholder")} maxLength={2000} />
        </Field>
      </FieldSet>

      <div
        className={cn(
          "sticky bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] z-20 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0",
        )}
      >
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
          {uploading ? t("produce.uploading") : busy ? t("common.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
