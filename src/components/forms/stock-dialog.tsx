"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-provider";
import { adjustStock, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useFormat } from "@/lib/i18n/format";
import { keys } from "@/lib/queries";
import type { Produce } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, UnitInput } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { toast } from "@/components/ui/toaster";
import { StockBar } from "@/components/domain/stock-bar";

type Kind = "restocked" | "spoiled" | "adjusted";

/** Restock, record spoilage, or correct the count. Every change lands in the stock log. */
export function StockDialog({ produce, open, onOpenChange }: { produce: Produce | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [kind, setKind] = useState<Kind>("restocked");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!produce) return null;
  const unit = f.unit(produce.unit);
  const kinds: { value: Kind; label: string; qtyLabel: string; hint?: string }[] = [
    { value: "restocked", label: t("ledger.restock"), qtyLabel: t("ledger.qtyRestock") },
    { value: "spoiled", label: t("ledger.markSpoiled"), qtyLabel: t("ledger.qtySpoiled") },
    { value: "adjusted", label: t("ledger.correct"), qtyLabel: t("ledger.qtyCorrect"), hint: t("ledger.correctHint") },
  ];
  const current = kinds.find((k) => k.value === kind)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!qty || Number.isNaN(n) || n === 0 || (kind !== "adjusted" && n < 0)) {
      setError(t("errors.positive"));
      return;
    }
    if (kind === "spoiled" && n > produce!.qty_available) {
      setError(t("ledger.tooMuch", { qty: f.number(produce!.qty_available), unit }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adjustStock(produce!.id, kind, n, note);
      toast.success(t("ledger.saved"));
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.myProduce(profile?.id) }),
        qc.invalidateQueries({ queryKey: keys.produce(produce!.id) }),
        qc.invalidateQueries({ queryKey: keys.ledger(produce!.id) }),
      ]);
      setQty("");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "exceeds_available"
          ? t("ledger.tooMuch", { qty: f.number(Number(err.hint ?? 0)), unit })
          : errorMessage(err, t),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("ledger.update")} description={produce.name} closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <StockBar name={produce.name} unit={produce.unit} sold={produce.qty_sold} reserved={produce.qty_reserved} available={produce.qty_available} spoiled={produce.qty_spoiled} animate={false} />
          <div role="radiogroup" aria-label={t("ledger.update")} className="grid grid-cols-3 gap-2">
            {kinds.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                onClick={() => {
                  setKind(k.value);
                  setError(null);
                }}
                className={cn(
                  "min-h-12 rounded-md border px-2 py-2 text-small font-semibold",
                  kind === k.value ? "border-role bg-role-soft text-ink" : "border-border-strong bg-surface text-ink hover:bg-sunken",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field id="stock-qty" label={current.qtyLabel} hint={current.hint}>
            <UnitInput unit={unit} value={qty} onChange={(e) => setQty(e.target.value)} step="any" min={kind === "adjusted" ? undefined : 0} />
          </Field>
          <Field id="stock-note" label={t("ledger.note")} optional={t("common.optional")}>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t("ledger.notePlaceholder")} />
          </Field>
          <Button type="submit" size="lg" loading={busy}>
            {current.label}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
