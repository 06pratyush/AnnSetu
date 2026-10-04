"use client";

import * as React from "react";
import { AlertDialog as AD, Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlayClass = "fixed inset-0 z-50 bg-scrim";

/**
 * Centered dialog on desktop, bottom sheet on phones (thumb reach).
 * side="right" makes a full-height side sheet on desktop.
 */
export function DialogContent({
  className,
  children,
  title,
  description,
  side = "center",
  closeLabel = "Close",
  ...props
}: React.ComponentProps<typeof D.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  side?: "center" | "right";
  closeLabel?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className={overlayClass} />
      <D.Content
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface text-ink shadow-pop outline-none",
          "inset-x-0 bottom-0 rounded-t-lg pb-[env(safe-area-inset-bottom,0px)]",
          side === "center" &&
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:pb-0",
          side === "right" && "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-lg",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <D.Title className="font-display text-h2 font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="text-small text-ink-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : ""}</D.Description>
            )}
          </div>
          <D.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label={closeLabel} className="-mr-2 -mt-1">
              <X />
            </Button>
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

type ConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
};

/** Confirmation for destructive or irreversible actions (reject order, archive listing). */
export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel, cancelLabel, tone = "danger", loading, onConfirm }: ConfirmProps) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay className={overlayClass} />
        <AD.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-w-md -translate-y-1/2 flex-col gap-4 rounded-lg bg-surface p-6 text-ink shadow-pop outline-none">
          <AD.Title className="font-display text-h2 font-semibold">{title}</AD.Title>
          {body ? <AD.Description className="text-body text-ink-muted">{body}</AD.Description> : <AD.Description className="sr-only">{typeof title === "string" ? title : ""}</AD.Description>}
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AD.Cancel asChild>
              <Button variant="secondary">{cancelLabel}</Button>
            </AD.Cancel>
            <Button
              variant={tone === "danger" ? "destructive" : "primary"}
              loading={loading}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
