// Shared household trips. The promise: households grouped into one trip never pay more than the
// shop for the same goods, delivery included, and the farmer is paid the trip when it pays for itself.
import type { PGlite } from "@electric-sql/pglite";
import type { Context } from "z3-solver";
import { beforeAll, describe } from "vitest";
import { as, createUser, freshDb, rows } from "../tests/pg";
import type { Dom, P, ZBool, ZNum } from "./dom";
import { splitTrip } from "./models/delivery";
import { suite } from "./z3";

const t = suite("delivery", "Shared household trips");

/** One household's share and everyone else's, under the current rule (a fee per saving, capped). */
function shares(Z: Context<P>, D: Dom<ZNum, ZBool>) {
  const [T, mine, rest] = ["trip", "mySaving", "othersSaving"].map((n) => Z.Real.const(n));
  const S = mine.add(rest);
  const covered = S.ge(T);
  const fee = (s: ZNum) => D.ite(covered, T.mul(s).div(S), s);
  return { T, mine, rest, S, covered, myFee: fee(mine), restFee: fee(rest), given: [T.gt(0), mine.ge(0), rest.ge(0), S.gt(0)] };
}

describe("who pays what", () => {
  t.theorem(
    "D1",
    "No household pays more than the shop, delivery included",
    "With savings s_i ≥ 0 (shop price − farm price, times quantity) and a trip T: the fee is T·s_i / S when the savings S cover T, and s_i otherwise. Either way 0 ≤ fee ≤ s_i, so farm price + fee ≤ shop price.",
    (Z, D) => {
      const x = shares(Z, D);
      return { given: x.given, claim: Z.And(x.myFee.ge(0), x.myFee.le(x.mine)), watch: { trip: x.T, mySaving: x.mine, othersSaving: x.rest, myFee: x.myFee } };
    },
  );

  t.theorem(
    "D2",
    "When the savings cover the trip, the farmer is paid exactly the trip",
    "If S ≥ T, the fees add up to T; if not (released at the cut-off), they add up to S < T and the farmer decides.",
    (Z, D) => {
      const x = shares(Z, D);
      const sum = x.myFee.add(x.restFee);
      return { given: x.given, claim: Z.And(Z.Implies(x.covered, sum.eq(x.T)), Z.Implies(Z.Not(x.covered), Z.And(sum.eq(x.S), sum.lt(x.T)))), watch: { trip: x.T, mySaving: x.mine, othersSaving: x.rest } };
    },
  );

  t.theorem(
    "D1-old",
    "Finding: splitting by weight could make a household pay more than the shop",
    "The deployed rule: fee = T·load_i / total load. Even with the savings covering the trip, a household with a small saving could pay more than it saved.",
    (Z) => {
      const [T, l1, l2, s1, s2] = ["trip", "myLoad", "othersLoad", "mySaving", "othersSaving"].map((n) => Z.Real.const(n));
      const fee = T.mul(l1).div(l1.add(l2));
      return { given: [T.gt(0), l1.gt(0), l2.gt(0), s1.ge(0), s2.ge(0), s1.add(s2).ge(T)], claim: fee.le(s1), watch: { trip: T, myLoad: l1, othersLoad: l2, mySaving: s1, othersSaving: s2, myFee: fee } };
    },
    { expect: "counterexample", note: "Fixed by migration 20261006000001: the trip is now split by saving, and capped at it." },
  );

  t.theorem(
    "D3",
    "The paise add up: rounding never breaks either promise",
    "For 5 households with whole-paise savings s_i and a whole-paise trip T ≤ S: shares x_i ≥ 0 with Σx_i = T and x_i ≤ s_i (D1, D2), each rounded down to ⌊x_i⌋, then the k = T − Σ⌊x_i⌋ paise left over given one each to households whose share had a fraction. Then fees add up to T exactly, each fee ≤ s_i, and k is never more than the number of fractional shares.",
    (Z, D) => {
      const n = 5;
      const T = Z.Int.const("trip");
      const s = Array.from({ length: n }, (_, i) => Z.Int.const(`saving${i}`));
      const x = Array.from({ length: n }, (_, i) => Z.Real.const(`share${i}`));
      const extra = Array.from({ length: n }, (_, i) => Z.Int.const(`extra${i}`));
      const base = x.map((xi) => D.floor(xi));
      const k = Z.ToReal(T).sub(base.reduce((a, b) => a.add(b)));
      const fractional = x.map((xi, i) => xi.gt(base[i]));
      const given: ZBool[] = [
        T.gt(0),
        ...s.map((si) => si.ge(0)),
        s.reduce((a, b) => a.add(b)).ge(T),
        x.reduce((a, b) => a.add(b)).eq(Z.ToReal(T)),
        ...x.flatMap((xi, i) => [xi.ge(0), xi.le(Z.ToReal(s[i]))]),
        ...extra.flatMap((e, i) => [e.ge(0), e.le(1), Z.Implies(e.eq(1), fractional[i])]),
        Z.ToReal(extra.reduce((a, b) => a.add(b))).eq(k),
      ];
      const fee = base.map((b, i) => b.add(Z.ToReal(extra[i])));
      const claim = Z.And(fee.reduce((a, b) => a.add(b)).eq(Z.ToReal(T)), ...fee.map((f, i) => f.le(Z.ToReal(s[i]))));
      return { given, claim, watch: { trip: T as unknown as ZNum } };
    },
  );

  t.theorem(
    "D3b",
    "There are always enough fractional shares for the paise left over",
    "With Σx_i = T (an integer), k = T − Σ⌊x_i⌋ is at most the number of i with x_i > ⌊x_i⌋, so 'one paisa each to the largest remainders' only ever picks shares with a fraction.",
    (Z, D) => {
      const n = 5;
      const T = Z.Int.const("trip");
      const x = Array.from({ length: n }, (_, i) => Z.Real.const(`share${i}`));
      const base = x.map((xi) => D.floor(xi));
      const k = Z.ToReal(T).sub(base.reduce((a, b) => a.add(b)));
      const count = x.map((xi, i) => Z.If(xi.gt(base[i]), Z.Real.val(1), Z.Real.val(0)) as ZNum).reduce((a, b) => a.add(b));
      return { given: [T.gt(0), ...x.map((xi) => xi.ge(0)), x.reduce((a, b) => a.add(b)).eq(Z.ToReal(T))], claim: k.le(count), watch: { trip: T as unknown as ZNum } };
    },
  );
});

// ---------------------------------------------------------------- the database splits the same way
const FARM = { lat: 26.9, lng: 75.8 };
const KM_PER_DEG = (6371 * Math.PI) / 180;
const drop = { lat: FARM.lat + 20 / KM_PER_DEG, lng: FARM.lng }; // 20 km: a Rs 520 trip
const SHOP = { tomato: 45, onion: 54, potato: 36 } as const; // sample mandi × 3.0 for vegetables
let db: PGlite;
let farmer: string;

describe("the database splits trips the same way", () => {
  beforeAll(async () => {
    db = await freshDb();
    farmer = await createUser(db, { role: "farmer", full_name: "Split Farmer" });
    await as(db, farmer, () =>
      db.query(`insert into public.addresses (label, line1, village_city, district, state, pincode, lat, lng) values ('farm','Plot 1','Chomu','Jaipur','Rajasthan','303702',$1,$2)`, [FARM.lat, FARM.lng]),
    );
  }, 120_000);

  async function listing(item: keyof typeof SHOP, price: number) {
    const id = await as(db, farmer, async () =>
      (await rows<{ id: string }>(db, `insert into public.produce (item_id, category, name, unit, price_per_unit, qty_listed, min_order_qty) values ($1, 'others', '', 'kg', $2, 100000, 1) returning id`, [item, price]))[0].id,
    );
    return { id, item, price };
  }
  async function household(listingId: string, qty: number, pin: string) {
    const b = await createUser(db, { role: "consumer", consumer_type: "individual", full_name: "Household" });
    await db.query(`update public.buyer_details set max_distance_km = 30 where user_id = $1`, [b]);
    const delivery = JSON.stringify({ name: "Home", phone: "9000000000", line1: "1 Main Rd", village_city: "Jaipur", district: "Jaipur", state: "Rajasthan", pincode: pin, lat: drop.lat, lng: drop.lng });
    const r = await as(db, b, () => rows<{ r: { orders: { order_id: string; status: string; batch: { id: string } }[] } }>(db, `select public.place_order($1::jsonb, $2::jsonb) as r`, [JSON.stringify([{ produce_id: listingId, quantity: qty }]), delivery]));
    return r[0].r.orders[0];
  }
  async function batchFees(batchId: string) {
    return rows<{ id: string; delivery_fee: string; quantity: string; unit_price: string; item_id: string }>(
      db,
      `select o.id, o.delivery_fee, oi.quantity, oi.unit_price, p.item_id
       from public.orders o join public.order_items oi on oi.order_id = o.id join public.produce p on p.id = oi.produce_id
       where o.batch_id = $1 order by o.id`,
      [batchId],
    );
  }
  const savingPaise = (o: { quantity: string; unit_price: string; item_id: string }) =>
    Math.floor(100 * Number(o.quantity) * Math.max(SHOP[o.item_id as keyof typeof SHOP] - Number(o.unit_price), 0) + 1e-9);

  t.check("D4", "30 trips of mixed orders: the database's fees equal the rule, add up to the trip, and never exceed a household's saving", async () => {
    let seed = 5;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const stalls = [await listing("tomato", 44), await listing("tomato", 20), await listing("onion", 30), await listing("potato", 25)];
    const problems: string[] = [];
    let households = 0;
    for (let trip = 0; trip < 30 && !problems.length; trip++) {
      const pin = String(310000 + trip);
      for (let guard = 0; guard < 60; guard++) {
        const stall = stalls[Math.floor(rnd() * stalls.length)];
        const o = await household(stall.id, 1 + Math.floor(rnd() * 8), pin);
        households++;
        if (o.status !== "placed") continue;
        const orders = await batchFees(o.batch.id);
        const savings = orders.map(savingPaise);
        const expected = splitTrip(52_000, savings);
        const actual = orders.map((x) => Math.round(Number(x.delivery_fee) * 100));
        if (actual.join() !== expected.join()) problems.push(`trip ${trip}: fees ${actual} ≠ rule ${expected} (savings ${savings})`);
        if (actual.reduce((a, b) => a + b, 0) !== 52_000) problems.push(`trip ${trip}: fees add up to ${actual.reduce((a, b) => a + b, 0)} paise, not 52,000`);
        actual.forEach((f, i) => f > savings[i] && problems.push(`trip ${trip}: a household pays ${f} paise against a saving of ${savings[i]}`));
        break;
      }
    }
    return { passed: problems.length === 0, detail: problems.length ? problems.slice(0, 3).join("; ") : `30 trips, ${households} households: every fee equal to the rule, every trip paid exactly Rs 520, no household above its saving` };
  });

  t.check("D5", "A trip released at its cut-off: each household pays its saving, the farmer sees the shortfall", async () => {
    const dear = await listing("tomato", 44);
    const a = await household(dear.id, 2, "319999");
    await household(dear.id, 3, "319999");
    await db.exec(`update public.delivery_batches set cutoff_at = now() - interval '1 minute' where status = 'open'`);
    await db.query(`select public.release_due_batches()`);
    const orders = await batchFees(a.batch.id);
    const fees = orders.map((x) => Math.round(Number(x.delivery_fee) * 100));
    const savings = orders.map(savingPaise);
    const flagged = (await rows<{ below_break_even: boolean }>(db, `select below_break_even from public.delivery_batches where id = $1`, [a.batch.id]))[0].below_break_even;
    const ok = fees.join() === savings.join() && flagged;
    return { passed: ok, detail: `savings ${savings.map((s) => s / 100)} → fees ${fees.map((f) => f / 100)} of a Rs 520 trip; below break-even flagged: ${flagged}` };
  });
});
