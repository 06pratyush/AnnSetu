import { Apple, Bean, Carrot, Droplet, Flame, Milk, Sprout, Wheat, type LucideIcon } from "lucide-react";
import type { CategorySlug } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The AnnSetu mark: a bridge arc whose farm half is khet green and whose buyer half is neel indigo,
 * with a turmeric grain at the crown. There is no official logo yet; this mark is a stand-in.
 */
export function BridgeArc({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={(size * 24) / 40} viewBox="0 0 40 24" fill="none" aria-hidden className={className}>
      <path d="M3 21 Q7 6 20 5" stroke="var(--khet)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M20 5 Q33 6 37 21" stroke="var(--neel)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M3 21 H37" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="20" cy="5" rx="3.2" ry="4.2" fill="var(--haldi)" />
    </svg>
  );
}

/** Wordmark: Latin name with its Devanagari twin. */
export function BrandMark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BridgeArc size={compact ? 28 : 34} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.375rem] font-bold tracking-tight text-ink">AnnSetu</span>
        {compact ? null : (
          <span lang="hi" className="font-display text-[0.8125rem] font-semibold text-ink-muted">
            अन्नसेतु
          </span>
        )}
      </span>
    </span>
  );
}

export const CATEGORY_ICONS: Record<CategorySlug, LucideIcon> = {
  vegetables: Carrot,
  fruits: Apple,
  grains: Wheat,
  pulses: Bean,
  spices: Flame,
  dairy: Milk,
  oilseeds: Droplet,
  others: Sprout,
};

export function CategoryIcon({ category, className }: { category: CategorySlug; className?: string }) {
  const Icon = CATEGORY_ICONS[category] ?? Sprout;
  return <Icon aria-hidden className={className} />;
}

/** Produce photo, or the category icon on a sunken tile when there is no photo. 4:3 cover crop. */
export function ProducePhoto({
  src,
  category,
  alt,
  className,
  iconClassName,
}: {
  src?: string | null;
  category: CategorySlug;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div className={cn("relative aspect-[4/3] w-full max-w-full overflow-hidden rounded-md bg-sunken", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center">
          <CategoryIcon category={category} className={cn("size-10 text-ink-muted", iconClassName)} />
        </div>
      )}
    </div>
  );
}
