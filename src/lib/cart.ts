"use client";

import { useSyncExternalStore } from "react";
import type { CartLine } from "./types";

const KEY = "annsetu.cart";
const EMPTY: CartLine[] = [];
let lines: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    lines = Array.isArray(parsed) ? parsed : [];
  } catch {
    lines = [];
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    listeners.forEach((l) => l());
  });
}

function commit(next: CartLine[]) {
  lines = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the cart lasts for this visit */
  }
  listeners.forEach((l) => l());
}

export const cart = {
  add(line: CartLine) {
    load();
    const existing = lines.find((l) => l.produceId === line.produceId);
    if (existing) commit(lines.map((l) => (l.produceId === line.produceId ? { ...line, quantity: line.quantity } : l)));
    else commit([...lines, line]);
  },
  setQuantity(produceId: string, quantity: number) {
    load();
    commit(lines.map((l) => (l.produceId === produceId ? { ...l, quantity } : l)));
  },
  remove(produceId: string) {
    load();
    commit(lines.filter((l) => l.produceId !== produceId));
  },
  clear() {
    load();
    commit([]);
  },
};

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** The cart lives in this browser only (localStorage); it is not shared across devices. */
export function useCart(): CartLine[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return lines;
    },
    () => EMPTY,
  );
}
