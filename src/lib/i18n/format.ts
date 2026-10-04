"use client";

import { useTranslation } from "react-i18next";
import { isLang, type Lang } from "./index";

export const intlLocale = (lang: Lang) => (lang === "hi" ? "hi-IN" : "en-IN");

export function formatMoney(value: number, lang: Lang) {
  return new Intl.NumberFormat(intlLocale(lang), {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

/** Compact money for stat tiles: ₹1.2L, ₹45K. */
export function formatMoneyCompact(value: number, lang: Lang) {
  if (Math.abs(value) < 100000) return formatMoney(Math.round(value), lang);
  return new Intl.NumberFormat(intlLocale(lang), {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number, lang: Lang, maxFractionDigits = 2) {
  return new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: maxFractionDigits }).format(value);
}

export function formatDate(value: string | Date, lang: Lang, style: "short" | "long" = "short") {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00` : value) : value;
  return new Intl.DateTimeFormat(intlLocale(lang), {
    day: "numeric",
    month: "short",
    year: style === "long" ? "numeric" : undefined,
  }).format(d);
}

export function formatDateTime(value: string | Date, lang: Lang) {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(lang), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatRelative(value: string | Date, lang: Lang) {
  const d = typeof value === "string" ? new Date(value) : value;
  const diffSec = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(d, lang, "long");
}

/** Formatting helpers bound to the current UI language. */
export function useFormat() {
  const { t, i18n } = useTranslation();
  const lang: Lang = isLang(i18n.language) ? i18n.language : "en";
  return {
    lang,
    money: (v: number) => formatMoney(v, lang),
    moneyCompact: (v: number) => formatMoneyCompact(v, lang),
    number: (v: number, digits?: number) => formatNumber(v, lang, digits),
    date: (v: string | Date, style?: "short" | "long") => formatDate(v, lang, style),
    dateTime: (v: string | Date) => formatDateTime(v, lang),
    relative: (v: string | Date) => formatRelative(v, lang),
    unit: (u: string) => t(`units.${u}`, { defaultValue: u }),
    /** "120 kg" */
    qty: (v: number, u: string) => `${formatNumber(v, lang)} ${t(`units.${u}`, { defaultValue: u })}`,
    /** "₹32/kg" */
    perUnit: (price: number, u: string) =>
      t("common.perUnit", { price: formatMoney(price, lang), unit: t(`units.${u}`, { defaultValue: u }) }),
  };
}
