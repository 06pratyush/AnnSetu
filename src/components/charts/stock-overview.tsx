"use client";

import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import type { Produce } from "@/lib/types";
import { StockBar } from "@/components/domain/stock-bar";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/**
 * Small multiples of the stock bar, one per listing: each bar is that listing's own 100%, so
 * listings sold in different units can sit side by side. The table view carries every number.
 */
export function StockOverview({ produce, view }: { produce: Produce[]; view: "chart" | "table" }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (view === "table") {
    return (
      <Table>
        <THead>
          <TR>
            <TH>{t("produce.name")}</TH>
            <TH className="text-right">{t("produce.listed")}</TH>
            <TH className="text-right">{t("produce.sold")}</TH>
            <TH className="text-right">{t("produce.reserved")}</TH>
            <TH className="text-right">{t("produce.available")}</TH>
            <TH className="text-right">{t("produce.spoiled")}</TH>
          </TR>
        </THead>
        <TBody>
          {produce.map((p) => (
            <TR key={p.id}>
              <TD className="font-semibold">{p.name}</TD>
              <TD numeric>{f.qty(p.qty_listed, p.unit)}</TD>
              <TD numeric>{f.qty(p.qty_sold, p.unit)}</TD>
              <TD numeric>{f.qty(p.qty_reserved, p.unit)}</TD>
              <TD numeric>{f.qty(p.qty_available, p.unit)}</TD>
              <TD numeric>{f.qty(p.qty_spoiled, p.unit)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-muted" aria-hidden>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-chart-1" />
          {t("produce.sold")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-chart-2" />
          {t("produce.reserved")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-stock-track ring-1 ring-border-strong ring-inset" />
          {t("produce.available")}
        </li>
      </ul>
      <ul className="flex flex-col gap-4">
        {produce.map((p) => (
          <li key={p.id} className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-4">
            <p className="truncate text-body font-semibold text-ink">{p.name}</p>
            <StockBar
              name={p.name}
              unit={p.unit}
              sold={p.qty_sold}
              reserved={p.qty_reserved}
              available={p.qty_available}
              spoiled={p.qty_spoiled}
              size="sm"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
