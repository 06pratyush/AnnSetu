// One model, two readings. Every model in proofs/models is written once against this interface:
// - on plain numbers (Num) it runs like the app, so tests can check it against the shipped code;
// - on Z3 terms (z3Dom) it becomes a formula, so the solver can prove a property for every input.
// Proving on the second reading and testing on the first ties the proofs to the real code.
import type { Arith, Bool, Context } from "z3-solver";

export interface Dom<N, B> {
  num(x: number | string): N;
  add(a: N, b: N): N;
  sub(a: N, b: N): N;
  mul(a: N, b: N): N;
  div(a: N, b: N): N;
  neg(a: N): N;
  lt(a: N, b: N): B;
  le(a: N, b: N): B;
  gt(a: N, b: N): B;
  ge(a: N, b: N): B;
  eq(a: N, b: N): B;
  and(...b: B[]): B;
  or(...b: B[]): B;
  not(b: B): B;
  implies(a: B, b: B): B;
  bool(x: boolean): B;
  /** Choice between two numbers, like `c ? a : b`. */
  ite(c: B, a: N, b: N): N;
  /** Choice between two conditions. */
  iteB(c: B, a: B, b: B): B;
  /** Math.min / Math.max of two numbers. */
  min(a: N, b: N): N;
  max(a: N, b: N): N;
  /** Math.floor, Math.ceil, and Math.round (halves go up). */
  floor(a: N): N;
  ceil(a: N): N;
  round(a: N): N;
}

/** Plain JavaScript numbers: the model runs exactly as the app would. */
export const Num: Dom<number, boolean> = {
  num: (x) => Number(x),
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => a / b,
  neg: (a) => -a,
  lt: (a, b) => a < b,
  le: (a, b) => a <= b,
  gt: (a, b) => a > b,
  ge: (a, b) => a >= b,
  eq: (a, b) => a === b,
  and: (...b) => b.every(Boolean),
  or: (...b) => b.some(Boolean),
  not: (b) => !b,
  implies: (a, b) => !a || b,
  bool: (x) => x,
  ite: (c, a, b) => (c ? a : b),
  iteB: (c, a, b) => (c ? a : b),
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

export type P = "annsetu";
export type ZNum = Arith<P>;
export type ZBool = Bool<P>;

let fresh = 0;

/**
 * Exact rational arithmetic in Z3: the model as a formula over every possible input.
 * floor(a) is a new integer k with k ≤ a < k + 1, which pins k to ⌊a⌋ exactly; the solver
 * handles these side conditions far better than nested to_int terms. They are collected in
 * `sides` and added to every theorem's assumptions.
 */
export function z3Dom(Z: Context<P>): Dom<ZNum, ZBool> & { sides: ZBool[] } {
  const val = (x: number | string) => Z.Real.val(x);
  const sides: ZBool[] = [];
  const floor = (a: ZNum) => {
    const k = Z.ToReal(Z.Int.const(`floor${fresh++}`));
    sides.push(k.le(a), a.lt(k.add(1)));
    return k;
  };
  return {
    sides,
    num: val,
    add: (a, b) => a.add(b),
    sub: (a, b) => a.sub(b),
    mul: (a, b) => a.mul(b),
    div: (a, b) => a.div(b),
    neg: (a) => a.neg(),
    lt: (a, b) => a.lt(b),
    le: (a, b) => a.le(b),
    gt: (a, b) => a.gt(b),
    ge: (a, b) => a.ge(b),
    eq: (a, b) => a.eq(b),
    and: (...b) => (b.length ? Z.And(...b) : Z.Bool.val(true)),
    or: (...b) => (b.length ? Z.Or(...b) : Z.Bool.val(false)),
    not: (b) => Z.Not(b),
    implies: (a, b) => Z.Implies(a, b),
    bool: (x) => Z.Bool.val(x),
    ite: (c, a, b) => Z.If(c, a, b) as ZNum,
    iteB: (c, a, b) => Z.If(c, a, b) as ZBool,
    min: (a, b) => Z.If(a.le(b), a, b) as ZNum,
    max: (a, b) => Z.If(a.ge(b), a, b) as ZNum,
    floor,
    ceil: (a) => floor(a.neg()).neg(),
    // Math.round(x) is floor(x + 1/2) for every real x (ties go up).
    round: (a) => floor(a.add(val("1/2"))),
  };
}
