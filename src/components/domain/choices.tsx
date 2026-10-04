"use client";

import { RadioGroup } from "radix-ui";
import { Building2, Check, Monitor, Moon, Sun, Tractor, User, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLang } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeChoice } from "@/lib/theme";

export type AccountChoice = "farmer" | "individual" | "industrial";

const ROLE_OPTIONS: { value: AccountChoice; icon: LucideIcon; role: "farmer" | "buyer" }[] = [
  { value: "farmer", icon: Tractor, role: "farmer" },
  { value: "individual", icon: User, role: "buyer" },
  { value: "industrial", icon: Building2, role: "buyer" },
];

/** Big radio cards for choosing the account type. Each card wears its side's role color. */
export function RoleChoiceCards({
  value,
  onChange,
  className,
  name = "account-type",
}: {
  value: AccountChoice | null;
  onChange: (v: AccountChoice) => void;
  className?: string;
  name?: string;
}) {
  const { t } = useTranslation();
  return (
    <RadioGroup.Root
      name={name}
      value={value ?? undefined}
      onValueChange={(v) => onChange(v as AccountChoice)}
      aria-label={t("auth.chooseRole")}
      className={cn("grid gap-3 sm:grid-cols-3", className)}
    >
      {ROLE_OPTIONS.map(({ value: v, icon: Icon, role }) => (
        <RadioGroup.Item
          key={v}
          value={v}
          data-role={role}
          className={cn(
            "group relative flex min-h-12 flex-col items-start gap-2 rounded-md border-2 border-border bg-surface p-4 text-left transition-colors",
            "hover:border-border-strong data-[state=checked]:border-role data-[state=checked]:bg-role-soft",
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-role-soft text-ink group-data-[state=checked]:bg-role group-data-[state=checked]:text-on-role">
            <Icon className="size-6" aria-hidden />
          </span>
          <span className="font-display text-h3 font-semibold text-ink">{t(v === "farmer" ? "roles.farmer" : `roles.${v}`)}</span>
          <span className="text-small text-ink-muted">{t(`roles.${v}Desc`)}</span>
          <RadioGroup.Indicator className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-role text-on-role">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </RadioGroup.Indicator>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/** EN | हिं segmented switch. Each option is labelled in its own language. */
export function LanguageToggle({ className, onChange }: { className?: string; onChange?: (l: Lang) => void }) {
  const { t } = useTranslation();
  const { lang, setLang } = useLang();
  const options: { value: Lang; label: string; full: string }[] = [
    { value: "en", label: "EN", full: "English" },
    { value: "hi", label: "हिं", full: "हिन्दी" },
  ];
  return (
    <div role="radiogroup" aria-label={t("common.language")} className={cn("inline-flex h-10 rounded-full border border-border-strong bg-surface p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={lang === o.value}
          lang={o.value}
          aria-label={o.full}
          onClick={() => {
            setLang(o.value);
            onChange?.(o.value);
          }}
          className={cn(
            "min-w-11 rounded-full px-3 text-small font-semibold transition-colors",
            lang === o.value ? "bg-ink text-bg" : "text-ink hover:bg-sunken",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const THEME_OPTIONS: { value: ThemeChoice; icon: LucideIcon; key: string }[] = [
  { value: "light", icon: Sun, key: "common.themeLight" },
  { value: "dark", icon: Moon, key: "common.themeDark" },
  { value: "system", icon: Monitor, key: "common.themeSystem" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label={t("common.theme")} className={cn("inline-flex h-10 rounded-full border border-border-strong bg-surface p-0.5", className)}>
      {THEME_OPTIONS.map(({ value, icon: Icon, key }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={t(key)}
          title={t(key)}
          onClick={() => setTheme(value)}
          className={cn("flex w-10 items-center justify-center rounded-full transition-colors", theme === value ? "bg-ink text-bg" : "text-ink hover:bg-sunken")}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
