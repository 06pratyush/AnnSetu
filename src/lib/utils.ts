import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge about the custom type scale so `text-small` and `text-ink` don't cancel out.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "body-lg", "body", "small", "label", "kpi"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Prefix a public asset path with the GitHub Pages base path. */
export function withBasePath(p: string) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${p}`;
}

/** Absolute URL of an app route, used for auth email redirects. */
export function appUrl(p: string) {
  if (typeof window === "undefined") return withBasePath(p);
  return `${window.location.origin}${withBasePath(p)}`;
}

