"use client";

import { Toaster as Sonner } from "sonner";

/** Toasts announce politely (aria-live) and use the surface tokens in both themes. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!bg-surface !text-ink !border !border-border !shadow-pop !rounded-md !font-body !text-body",
          description: "!text-ink-muted",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          closeButton: "!bg-surface !border-border !text-ink",
        },
      }}
    />
  );
}

export { toast } from "sonner";
