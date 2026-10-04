"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** False during prerender and hydration, true once running in the browser. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
