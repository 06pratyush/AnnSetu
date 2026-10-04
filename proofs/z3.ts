// The solver session, the "prove or find a counterexample" call, and the record each proof file
// leaves in proofs/results/ for the report (npm run prove writes proofs/REPORT.md from them).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { init, type Context } from "z3-solver";
import { afterAll, expect, it } from "vitest";
import { z3Dom, type Dom, type P, type ZBool, type ZNum } from "./dom";

type Session = { Z: Context<P>; stop: () => void };
let session: Promise<Session> | null = null;

export function z3(): Promise<Session> {
  session ??= init().then(({ Context, em }) => {
    const Z = new Context("annsetu") as Context<P>;
    return { Z, stop: () => em.PThread.terminateAllThreads() };
  });
  return session;
}

export type Status = "proved" | "counterexample" | "unknown";
export interface Outcome {
  status: Status;
  ms: number;
  example?: Record<string, string>;
  reason?: string;
}

function show(v: unknown): string {
  const x = v as { asNumber?: () => number; toString(): string };
  try {
    if (typeof x.asNumber === "function") {
      const n = x.asNumber();
      if (Number.isFinite(n)) return n !== 0 && Math.abs(n) < 0.001 ? n.toPrecision(3) : String(Math.round(n * 1e6) / 1e6);
    }
  } catch {
    /* algebraic numbers have no exact float; fall through */
  }
  return x.toString();
}

/**
 * Proves `given ⇒ claim` for every value of every variable by asking Z3 for a case where
 * `given` holds and `claim` fails. None exists: proved. One exists: it is the counterexample.
 */
export async function check(given: ZBool[], claim: ZBool, watch: Record<string, ZNum | ZBool> = {}, timeoutMs = 120_000): Promise<Outcome> {
  const { Z } = await z3();
  const s = new Z.Solver();
  s.set("timeout", timeoutMs);
  s.add(...given, Z.Not(claim));
  const t0 = performance.now();
  const r = await s.check();
  const ms = Math.round(performance.now() - t0);
  if (r === "unsat") return { status: "proved", ms };
  if (r === "unknown") return { status: "unknown", ms, reason: s.reasonUnknown() };
  const m = s.model();
  const example: Record<string, string> = {};
  for (const [k, e] of Object.entries(watch)) example[k] = show(m.eval(e, true));
  return { status: "counterexample", ms, example };
}

export interface TheoremRecord {
  kind: "theorem";
  id: string;
  title: string;
  statement: string;
  /** What we expect: "proved", or "counterexample" for a finding kept to show what was wrong. */
  expect: Status;
  outcome: Outcome;
  note?: string;
}
export interface CheckRecord {
  kind: "check";
  id: string;
  title: string;
  detail: string;
  passed: boolean;
}
type Rec = TheoremRecord | CheckRecord;

export interface TheoremBody {
  given: ZBool[];
  claim: ZBool;
  watch?: Record<string, ZNum | ZBool>;
}

/** One proof file: theorems and checks, saved to proofs/results/<name>.json when the file ends. */
export function suite(name: string, group: string) {
  const records: Rec[] = [];
  afterAll(async () => {
    const dir = path.join(process.cwd(), "proofs/results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${name}.json`), JSON.stringify({ group, records }, null, 2));
    if (session) (await session).stop();
  });

  return {
    theorem(
      id: string,
      title: string,
      statement: string,
      body: (Z: Context<P>, D: Dom<ZNum, ZBool>) => TheoremBody | Promise<TheoremBody>,
      opts: { expect?: Status; note?: string; timeoutMs?: number } = {},
    ) {
      const want = opts.expect ?? "proved";
      it(`${id}. ${title}`, async () => {
        const { Z } = await z3();
        const D = z3Dom(Z);
        const b = await body(Z, D);
        const outcome = await check([...b.given, ...D.sides], b.claim, b.watch ?? {}, opts.timeoutMs);
        records.push({ kind: "theorem", id, title, statement, expect: want, outcome, note: opts.note });
        if (outcome.status !== want) console.log(id, outcome);
        expect(outcome.status).toBe(want);
      }, (opts.timeoutMs ?? 120_000) + 30_000);
    },
    /** A finite check that ties a model to the shipped code, or covers a case exhaustively. */
    check(id: string, title: string, run: () => { passed: boolean; detail: string } | Promise<{ passed: boolean; detail: string }>, timeoutMs = 300_000) {
      it(`${id}. ${title}`, async () => {
        const r = await run();
        records.push({ kind: "check", id, title, detail: r.detail, passed: r.passed });
        if (!r.passed) console.log(id, r.detail);
        expect(r.passed).toBe(true);
      }, timeoutMs);
    },
  };
}

/** Fresh real-valued unknowns, one per name. */
export function reals<K extends string>(Z: Context<P>, prefix: string, names: readonly K[]): Record<K, ZNum> {
  return Object.fromEntries(names.map((n) => [n, Z.Real.const(`${prefix}${n}`)])) as Record<K, ZNum>;
}
