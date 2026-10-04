"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Free-text tags: type, press Enter (or comma) to add; each chip has its own remove button. */
export function ChipInput({
  id,
  value,
  onChange,
  max = 20,
  removeLabel,
  className,
  ...aria
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  removeLabel: (item: string) => string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const item = draft.trim().replace(/,$/, "");
    if (item && !value.some((v) => v.toLowerCase() === item.toLowerCase()) && value.length < max) onChange([...value, item]);
    setDraft("");
  }
  return (
    <div className={cn("flex min-h-12 flex-wrap items-center gap-2 rounded-sm border border-border-strong bg-surface p-2 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus", className)}>
      {value.map((v) => (
        <span key={v} className="inline-flex h-8 items-center gap-1 rounded-full bg-role-soft pr-1 pl-3 text-small font-semibold text-ink">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="flex size-7 items-center justify-center rounded-full hover:bg-surface"
            aria-label={removeLabel(v)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => {
          if (e.target.value.endsWith(",")) {
            setDraft(e.target.value.slice(0, -1));
            setTimeout(commit, 0);
          } else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        className="h-8 min-w-32 flex-1 bg-transparent px-1 text-body text-ink outline-none"
        {...aria}
      />
    </div>
  );
}
