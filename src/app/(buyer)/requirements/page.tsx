"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { RoleGuard } from "@/lib/auth/role-guard";
import { createDemand, setDemandStatus } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useFormat } from "@/lib/i18n/format";
import { keys, useMyDemand } from "@/lib/queries";
import { CATEGORY_SLUGS, type CategorySlug, type DemandRequest, type DemandStatus, type Unit } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea, UnitInput } from "@/components/ui/input";
import { Alert, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { PageHeader } from "@/components/layout/app-shell";
import { CategoryIcon } from "@/components/domain/brand";
import { EmptyState } from "@/components/domain/empty-state";
import { UnitSelect } from "@/components/domain/figures";

function RequirementForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [item, setItem] = useState("");
  const [category, setCategory] = useState<CategorySlug>("vegetables");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [price, setPrice] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!item.trim()) next.item = t("errors.required");
    if (!qty || Number(qty) <= 0) next.qty = t("errors.positive");
    if (price && Number(price) <= 0) next.price = t("errors.positive");
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await createDemand({
        category,
        item_name: item.trim(),
        quantity: Number(qty),
        unit,
        target_price: price ? Number(price) : null,
        needed_by: neededBy || null,
        notes: notes.trim() || null,
      });
      toast.success(t("requirements.posted"));
      await qc.invalidateQueries({ queryKey: keys.myDemand(profile?.id) });
      onDone();
    } catch (err) {
      setFormError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="r-item" label={t("requirements.item")} error={errors.item}>
          <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder={t("requirements.itemPlaceholder")} maxLength={80} />
        </Field>
        <Field id="r-category" label={t("produce.category")}>
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value as CategorySlug)}>
            {CATEGORY_SLUGS.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="r-qty" label={t("common.quantity")} error={errors.qty}>
          <UnitInput unit={f.unit(unit)} value={qty} onChange={(e) => setQty(e.target.value)} min={0} step="any" />
        </Field>
        <Field id="r-unit" label={t("produce.unit")}>
          <UnitSelect value={unit} onChange={(e) => setUnit(e.target.value as Unit)} />
        </Field>
        <Field id="r-price" label={t("requirements.targetPrice", { unit: f.unit(unit) })} optional={t("common.optional")} error={errors.price}>
          <UnitInput unit={`₹/${f.unit(unit)}`} value={price} onChange={(e) => setPrice(e.target.value)} min={0} step="any" />
        </Field>
        <Field id="r-date" label={t("requirements.neededBy")} optional={t("common.optional")}>
          <Input type="date" value={neededBy} min={today} onChange={(e) => setNeededBy(e.target.value)} />
        </Field>
      </div>
      <Field id="r-notes" label={t("requirements.details")} optional={t("common.optional")}>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("requirements.detailsPlaceholder")} maxLength={1000} />
      </Field>
      <Button type="submit" size="lg" loading={busy}>
        {t("requirements.post")}
      </Button>
    </form>
  );
}

function RequirementRow({ d }: { d: DemandRequest }) {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const tone = d.status === "open" ? "accent" : d.status === "fulfilled" ? "success" : "neutral";
  async function set(status: DemandStatus) {
    setBusy(true);
    try {
      await setDemandStatus(d.id, status);
      await qc.invalidateQueries({ queryKey: keys.myDemand(profile?.id) });
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-haldi-soft">
          <CategoryIcon category={d.category} className="size-5 text-haldi-ink" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-h3 font-semibold text-ink">{d.item_name}</h3>
            <Badge tone={tone}>{t(`requirements.status.${d.status}`)}</Badge>
          </div>
          <p className="text-body text-ink tabular-nums">
            {t("requirements.needed", { qty: f.number(d.quantity), unit: f.unit(d.unit) })}
            {d.target_price ? <span className="text-ink-muted"> · {f.perUnit(d.target_price, d.unit)}</span> : null}
          </p>
          {d.needed_by ? (
            <p className="flex items-center gap-1.5 text-small text-ink-muted">
              <CalendarDays className="size-4" aria-hidden />
              {t("requirements.by", { date: f.date(d.needed_by) })}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2">
        {d.status === "open" ? (
          <>
            <Button variant="secondary" size="sm" loading={busy} onClick={() => void set("fulfilled")}>
              {t("requirements.markFulfilled")}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void set("closed")}>
              {t("requirements.close")}
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" loading={busy} onClick={() => void set("open")}>
            {t("requirements.reopen")}
          </Button>
        )}
      </div>
    </li>
  );
}

function Requirements() {
  const { t } = useTranslation();
  const demand = useMyDemand();
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title={t("requirements.title")}
        subtitle={t("requirements.subtitle")}
        actions={
          <Button size="lg" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            {t("requirements.add")}
          </Button>
        }
      />
      {demand.isLoading ? (
        <Skeleton className="h-40" />
      ) : !demand.data?.length ? (
        <EmptyState icon={ClipboardList} title={t("requirements.empty")} body={t("requirements.emptyBody")} action={<Button onClick={() => setOpen(true)}>{t("requirements.add")}</Button>} />
      ) : (
        <ul className="flex flex-col gap-3">
          {demand.data.map((d) => (
            <RequirementRow key={d.id} d={d} />
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("requirements.add")} closeLabel={t("common.close")}>
          <RequirementForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function RequirementsPage() {
  return (
    <RoleGuard role="consumer">
      <Requirements />
    </RoleGuard>
  );
}
