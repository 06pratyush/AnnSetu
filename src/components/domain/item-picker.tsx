"use client";

import { useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLang } from "@/lib/i18n/provider";
import { searchCatalogue, type CatalogueIndex, type CatalogueItem } from "@/lib/matching/search";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./brand";
import type { CategorySlug } from "@/lib/types";

/**
 * Step 1 as a control: type any spelling (English, Hinglish or Hindi) and pick the catalogue item.
 * A non-exact match is never applied silently; the closest items are offered to choose from.
 */
export function ItemPicker({
  index,
  value,
  onChange,
  id,
  cutoff = 0.55,
  placeholder,
  className,
  ...aria
}: {
  index: CatalogueIndex;
  value: CatalogueItem | null;
  onChange: (item: CatalogueItem | null) => void;
  id?: string;
  cutoff?: number;
  placeholder?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const result = useMemo(() => searchCatalogue(index, query, cutoff, 6), [index, query, cutoff]);
  const label = (i: CatalogueItem) => (lang === "hi" ? `${i.nameHi} · ${i.nameEn}` : `${i.nameEn} · ${i.nameHi}`);
  const options = result.hits;

  function choose(item: CatalogueItem) {
    onChange(item);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      {value && !open ? (
        <button
          type="button"
          id={id}
          onClick={() => setOpen(true)}
          className="flex h-12 w-full items-center gap-3 rounded-sm border border-border-strong bg-surface px-3 text-left text-body text-ink"
          aria-describedby={aria["aria-describedby"]}
        >
          <CategoryIcon category={value.category as CategorySlug} className="size-5 text-ink-muted" />
          <span className="min-w-0 flex-1 truncate font-semibold">{label(value)}</span>
          <span className="text-small text-ink-muted underline underline-offset-4">{t("common.change")}</span>
        </button>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            id={id}
            role="combobox"
            aria-expanded={open && options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? `${listId}-${options[active].item.id}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, options.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && options[active]) {
                e.preventDefault();
                choose(options[active].item);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className="h-12 w-full rounded-sm border border-border-strong bg-surface pr-3 pl-10 text-body text-ink aria-[invalid=true]:border-danger"
            {...aria}
          />
        </div>
      )}

      {open && query.trim() ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-surface shadow-pop">
          {result.didYouMean ? (
            <p className="border-b border-border px-3 py-2 text-small text-ink-muted">{t("matching.didYouMean")}</p>
          ) : null}
          {options.length === 0 ? (
            <p className="px-3 py-3 text-small text-ink-muted">{t("matching.noItem")}</p>
          ) : (
            <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
              {options.map((h, i) => (
                <li
                  key={h.item.id}
                  id={`${listId}-${h.item.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(h.item);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3", i === active && "bg-sunken")}
                >
                  <CategoryIcon category={h.item.category as CategorySlug} className="size-5 shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-ink">{label(h.item)}</span>
                    {!h.exact ? <span className="block truncate text-label text-ink-muted">“{h.matched}”</span> : null}
                  </span>
                  {value?.id === h.item.id ? <Check className="size-5 text-role" aria-hidden /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
