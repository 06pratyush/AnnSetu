import { useSyncExternalStore } from "react";

// The current time as an external store, so components read it without calling Date.now()
// during render. It ticks once a minute while anything is subscribed.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(tick, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const snapshot = () => now;

/** Milliseconds since the epoch, accurate to the minute. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
