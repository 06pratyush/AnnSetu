"use client";

import * as React from "react";
import { Checkbox as CB, Switch as SW, Tabs as TB, DropdownMenu as DM, Tooltip as TT, Avatar as AV } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* Checkbox with its label: the whole row is the 48px touch target. */
export function Checkbox({
  label,
  description,
  className,
  id,
  ...props
}: React.ComponentProps<typeof CB.Root> & { label: React.ReactNode; description?: React.ReactNode; id: string }) {
  return (
    <div className={cn("flex min-h-12 items-start gap-3 py-2", className)}>
      <CB.Root
        id={id}
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface data-[state=checked]:border-role data-[state=checked]:bg-role data-[state=checked]:text-on-role"
        {...props}
      >
        <CB.Indicator>
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </CB.Indicator>
      </CB.Root>
      <label htmlFor={id} className="flex cursor-pointer flex-col">
        <span className="text-body font-medium text-ink">{label}</span>
        {description ? <span className="text-small text-ink-muted">{description}</span> : null}
      </label>
    </div>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SW.Root>) {
  return (
    <SW.Root
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border-strong bg-sunken transition-colors data-[state=checked]:border-role data-[state=checked]:bg-role",
        className,
      )}
      {...props}
    >
      <SW.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface shadow-card transition-transform data-[state=checked]:translate-x-[1.375rem]" />
    </SW.Root>
  );
}

/* Tabs: underline style in the role color. */
export const Tabs = TB.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof TB.List>) {
  return <TB.List className={cn("flex gap-1 overflow-x-auto border-b border-border", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TB.Trigger>) {
  return (
    <TB.Trigger
      className={cn(
        "-mb-px inline-flex h-12 items-center gap-2 border-b-[3px] border-transparent px-3 text-body font-semibold whitespace-nowrap text-ink-muted transition-colors hover:text-ink data-[state=active]:border-role data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = TB.Content;

/* Dropdown menu */
export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        className={cn("z-50 min-w-48 rounded-md border border-border bg-surface p-1 text-ink shadow-pop", className)}
        {...props}
      />
    </DM.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 text-body outline-none select-none data-[highlighted]:bg-sunken [&_svg]:size-5 [&_svg]:text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn("px-3 py-2 text-label font-semibold text-ink-muted", className)} {...props} />;
}
export function DropdownMenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-border" />;
}
export const DropdownMenuRadioGroup = DM.RadioGroup;
export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 text-body outline-none select-none data-[highlighted]:bg-sunken",
        className,
      )}
      {...props}
    >
      <span className="flex size-5 items-center justify-center">
        <DM.ItemIndicator>
          <Check className="size-4 text-role" strokeWidth={3} aria-hidden />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.RadioItem>
  );
}

/* Tooltip: desktop hint only; never the sole carrier of information. */
export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  return (
    <TT.Provider delayDuration={300}>
      <TT.Root>
        <TT.Trigger asChild>{children}</TT.Trigger>
        <TT.Portal>
          <TT.Content sideOffset={6} className="z-50 max-w-64 rounded-sm bg-ink px-2.5 py-1.5 text-small text-bg shadow-pop">
            {content}
          </TT.Content>
        </TT.Portal>
      </TT.Root>
    </TT.Provider>
  );
}

/* Avatar: photo, or initials on the role tint. */
export function Avatar({ src, name, size = 40, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <AV.Root
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-role-soft align-middle", className)}
      style={{ width: size, height: size }}
    >
      {src ? <AV.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AV.Fallback className="font-display font-semibold text-ink" style={{ fontSize: size * 0.4 }}>
        {initials || "?"}
      </AV.Fallback>
    </AV.Root>
  );
}
