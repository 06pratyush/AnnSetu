// Demo mode: when no Supabase project is configured, AnnSetu runs its whole database in this
// browser: every migration, row-level security rule and function, in PGlite (Postgres compiled to
// WebAssembly), saved in IndexedDB. Nothing leaves the browser; connect Supabase to share data.
import type { IdbFs, PGlite, Transaction } from "@electric-sql/pglite";

const PGLITE_URL = "https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/index.js";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const STORE = "annsetu-demo-";

export type DemoStatus = "idle" | "loading" | "ready" | "busy" | "failed";
let status: DemoStatus = "idle";
const watchers = new Set<() => void>();

export const getDemoStatus = () => status;
export function subscribeDemoStatus(cb: () => void) {
  watchers.add(cb);
  return () => {
    watchers.delete(cb);
  };
}
function setStatus(next: DemoStatus) {
  status = next;
  watchers.forEach((cb) => cb());
}

/** Another tab already has the demo database open; two writers would overwrite each other. */
export class DemoBusyError extends Error {
  constructor() {
    super("demo_busy");
  }
}

// A runtime import the bundler leaves alone: PGlite and its WebAssembly load from the CDN, and only
// in demo mode, so a site connected to Supabase never downloads them.
const importFromUrl = new Function("url", "return import(url)") as (url: string) => Promise<typeof import("@electric-sql/pglite")>;

/** Postgres's text form of a timestamp, as the ISO string Supabase would send. */
function iso(v: string): string {
  const m = /^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d(?:\.\d+)?)(?:([+-]\d\d)(?::?(\d\d))?)?$/.exec(v);
  if (!m) return v;
  return `${m[1]}T${m[2]}${m[3] ? `${m[3]}:${m[4] ?? "00"}` : ""}`;
}

/**
 * Holds a lock for the life of this tab; false when another tab keeps it. Waits a moment first:
 * on a reload, the page being replaced may still be letting go of it.
 */
function claimTab(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) return Promise.resolve(true);
  return new Promise((resolve) => {
    navigator.locks
      .request("annsetu-demo-db", { signal: AbortSignal.timeout(4000) }, () => {
        resolve(true);
        return new Promise<void>(() => {}); // released when the tab closes
      })
      .catch(() => resolve(false));
  });
}

async function text(file: string) {
  const res = await fetch(`${BASE}/demo/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`demo_${file}_${res.status}`);
  return res.text();
}

/** Deletes demo databases left by earlier versions of the schema. */
async function dropOldStores(current: string) {
  try {
    const all = await indexedDB.databases();
    for (const d of all) if (d.name?.includes(STORE) && !d.name.includes(current)) indexedDB.deleteDatabase(d.name);
  } catch {
    /* not supported everywhere; old stores just stay */
  }
}

async function open(): Promise<PGlite> {
  setStatus("loading");
  if (!(await claimTab())) throw new DemoBusyError();
  const { version } = JSON.parse(await text("manifest.json")) as { version: string };
  const { PGlite, IdbFs, types } = await importFromUrl(PGLITE_URL);
  store = new IdbFs(`${STORE}${version}`);
  const db = await PGlite.create({
    fs: store,
    parsers: {
      [types.NUMERIC]: (v: string) => Number(v),
      [types.INT8]: (v: string) => Number(v),
      [types.TIMESTAMPTZ]: iso,
      [types.TIMESTAMP]: iso,
      [types.DATE]: (v: string) => v,
    },
  });
  const ready = await db.query<{ ok: boolean }>(`select to_regclass('public.profiles') is not null as ok`);
  if (!ready.rows[0]?.ok) {
    const [stubs, setup] = await Promise.all([text("stubs.sql"), text("setup.sql")]);
    await db.exec(stubs);
    await db.exec(setup);
    // A few demo farms, so the market isn't empty before anyone shares a location.
    const { addDemoNeighbours, FIRST_PLACE } = await import("./neighbours");
    await addDemoNeighbours(FIRST_PLACE, (fn) => db.transaction(fn));
  }
  void dropOldStores(version);
  setStatus("ready");
  return db;
}

let opening: Promise<PGlite> | null = null;
let store: IdbFs | null = null;

/**
 * Waits until everything written so far is in IndexedDB. Called after every write, so leaving or
 * reloading the page straight after an action never loses it (PGlite's own sync can return while
 * an earlier one is still queued).
 */
export async function flushDemo(): Promise<void> {
  await demoDb();
  await store?.syncToFs(false);
}

/** The demo database, opened (and created on the first visit) on first use. */
export function demoDb(): Promise<PGlite> {
  opening ??= open().catch((err: unknown) => {
    setStatus(err instanceof DemoBusyError ? "busy" : "failed");
    opening = null;
    throw err;
  });
  return opening;
}

/**
 * Runs fn as a browser request would on Supabase: as `authenticated` with auth.uid() = userId (or
 * as `anon`), so row-level security, column grants and the functions' checks all apply.
 */
export async function asUser<T>(userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const db = await demoDb();
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
    await tx.exec(userId ? "set local role authenticated" : "set local role anon");
    return fn(tx);
  });
}

/** Runs fn as the database owner: sign-up, sign-in and the demo neighbours only. */
export async function asOwner<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const db = await demoDb();
  return db.transaction(fn);
}
