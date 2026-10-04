"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/i18n/format";
import type { Order } from "@/lib/types";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export type WeekPoint = { weekStart: Date; label: string; total: number };

/** Sums delivered orders into the last `weeks` calendar weeks (Monday start), oldest first. */
export function weeklyRevenue(orders: Order[], weeks: number, label: (d: Date) => string): WeekPoint[] {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    points.push({ weekStart: start, label: label(start), total: 0 });
  }
  for (const o of orders) {
    if (o.status !== "delivered") continue;
    const at = new Date(o.status_history.find((h) => h.status === "delivered")?.at ?? o.updated_at);
    for (let i = points.length - 1; i >= 0; i--) {
      if (at >= points[i].weekStart) {
        if (i === points.length - 1 || at < points[i + 1].weekStart) points[i].total += o.total;
        break;
      }
    }
  }
  return points;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: WeekPoint }[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-sm border border-border bg-surface px-3 py-2 text-small text-ink shadow-pop">
      <p className="text-ink-muted">{t("dashboard.week", { date: f.date(p.weekStart) })}</p>
      <p className="font-semibold tabular-nums">{f.money(p.total)}</p>
    </div>
  );
}

/** One series, so no legend: the card title names it. Columns ≤24px with a 4px rounded cap. */
export function RevenueChart({ data, view }: { data: WeekPoint[]; view: "chart" | "table" }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (view === "table") {
    return (
      <Table>
        <THead>
          <TR>
            <TH>{t("dashboard.weekCol")}</TH>
            <TH className="text-right">{t("dashboard.revenue")}</TH>
          </TR>
        </THead>
        <TBody>
          {data.map((d) => (
            <TR key={d.label}>
              <TD>{f.date(d.weekStart)}</TD>
              <TD numeric>{f.money(d.total)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    );
  }
  return (
    <div className="h-56 w-full" role="img" aria-label={`${t("dashboard.revenueTitle")}: ${data.map((d) => `${d.label} ${f.money(d.total)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fill: "var(--ink-muted)", fontSize: 12 }} interval={0} />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-muted)", fontSize: 12 }}
            tickFormatter={(v: number) => f.moneyCompact(v)}
            allowDecimals={false}
          />
          <Tooltip cursor={{ fill: "var(--sunken)" }} content={<ChartTooltip />} />
          <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
