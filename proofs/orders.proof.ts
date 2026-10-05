// Orders and stock. The design doc's check: "Stock never drops below zero, even when many buyers
// order in the same instant".
import type { PGlite } from "@electric-sql/pglite";
import type { Context } from "z3-solver";
import { beforeAll, describe } from "vitest";
import { as, createUser, freshDb, rows } from "../tests/pg";
import type { P, ZBool, ZNum } from "./dom";
import { allowed, applyAdjust, applyMove, available, FINISHED, HOLDING, MOVES, STATUSES, type Actor, type Status, type Stock } from "./models/orders";
import { suite } from "./z3";

const t = suite("orders", "Orders and stock (step 4)");

// ---------------------------------------------------------------- the lifecycle in Z3
const NONE = STATUSES.length; // an order not placed yet
const idx = (s: Status) => STATUSES.indexOf(s);
const ACTORS: Actor[] = ["farmer", "buyer", "system"];

function lifecycle(Z: Context<P>) {
  const isOneOf = (x: ReturnType<typeof Z.Int.const>, set: readonly Status[]) => Z.Or(...set.map((s) => x.eq(idx(s))));
  const allowedZ = (from: ReturnType<typeof Z.Int.const>, to: ReturnType<typeof Z.Int.const>, actor: ReturnType<typeof Z.Int.const>) =>
    Z.Or(...ACTORS.flatMap((a, k) => MOVES[a].map(([f, g]) => Z.And(actor.eq(k), from.eq(idx(f)), to.eq(idx(g))))));
  return {
    allowedZ,
    holding: (x: ReturnType<typeof Z.Int.const>) => isOneOf(x, HOLDING),
    finished: (x: ReturnType<typeof Z.Int.const>) => isOneOf(x, FINISHED),
    delivered: (x: ReturnType<typeof Z.Int.const>) => x.eq(idx("delivered")),
  };
}

describe("the lifecycle", () => {
  const vars = (Z: Context<P>) => ({ from: Z.Int.const("from"), to: Z.Int.const("to"), actor: Z.Int.const("actor") });
  t.theorem(
    "O1",
    "A finished order never changes again",
    "For every allowed move from → to (by the farmer, the buyer or a released trip): from is not rejected, delivered or cancelled.",
    (Z) => {
      const L = lifecycle(Z);
      const { from, to, actor } = vars(Z);
      return { given: [L.allowedZ(from, to, actor)], claim: Z.Not(L.finished(from)), watch: { from, to, actor } as unknown as Record<string, ZNum> };
    },
  );
  t.theorem(
    "O2",
    "Every move starts from an order that holds stock, and either keeps holding it or finishes",
    "For every allowed move from → to: from holds its quantity in reserve, and to either still holds it or is finished.",
    (Z) => {
      const L = lifecycle(Z);
      const { from, to, actor } = vars(Z);
      return { given: [L.allowedZ(from, to, actor)], claim: Z.And(L.holding(from), Z.Or(L.holding(to), L.finished(to))), watch: { from, to } as unknown as Record<string, ZNum> };
    },
  );
});

// ---------------------------------------------------------------- stock, one step at a time
/**
 * The invariant, for one listing and any one order on it: the four counters are never negative,
 * nothing more is promised than is there (available ≥ 0), and reserved and sold are exactly the
 * sums over orders that hold or delivered their quantity. "rest" is every other order's share,
 * which a step on this order or on the listing leaves alone; so it holds for any number of orders.
 */
function stockState(Z: Context<P>, tag: string) {
  const r = (n: string) => Z.Real.const(`${tag}${n}`);
  return { listed: r("listed"), sold: r("sold"), reserved: r("reserved"), spoiled: r("spoiled"), st: Z.Int.const(`${tag}status`) };
}
type St = ReturnType<typeof stockState>;

function invariant(Z: Context<P>, s: St, rest: { reserved: ZNum; sold: ZNum }, q: ZNum): ZBool {
  const L = lifecycle(Z);
  return Z.And(
    s.sold.ge(0),
    s.reserved.ge(0),
    s.spoiled.ge(0),
    s.listed.sub(s.sold).sub(s.reserved).sub(s.spoiled).ge(0),
    rest.reserved.ge(0),
    rest.sold.ge(0),
    q.gt(0),
    s.st.ge(0),
    s.st.le(NONE),
    s.reserved.eq(rest.reserved.add(Z.If(L.holding(s.st), q, Z.Real.val(0)) as ZNum)),
    s.sold.eq(rest.sold.add(Z.If(L.delivered(s.st), q, Z.Real.val(0)) as ZNum)),
  );
}

describe("stock never goes below zero", () => {
  const setup = (Z: Context<P>) => {
    const s = stockState(Z, "");
    const rest = { reserved: Z.Real.const("restReserved"), sold: Z.Real.const("restSold") };
    const q = Z.Real.const("q");
    const avail = s.listed.sub(s.sold).sub(s.reserved).sub(s.spoiled);
    return { s, rest, q, avail };
  };
  const after = (s: St, change: Partial<Omit<St, "st">>, st: St["st"] = s.st): St => ({ ...s, ...change, st });

  t.theorem(
    "O3",
    "Placing an order keeps every count right",
    "place_order checks q ≤ available under the row lock, then adds q to reserved; from a state where the invariant holds, it still holds.",
    (Z) => {
      const { s, rest, q, avail } = setup(Z);
      const to = Z.Int.const("to");
      const next = after(s, { reserved: s.reserved.add(q) }, to);
      return {
        given: [invariant(Z, s, rest, q), s.st.eq(NONE), q.le(avail), Z.Or(to.eq(idx("pooling")), to.eq(idx("placed")))],
        claim: invariant(Z, next, rest, q),
        watch: { listed: s.listed, reserved: s.reserved, q },
      };
    },
  );

  t.theorem(
    "O4",
    "Every status change keeps every count right, and gives stock back exactly once",
    "For every allowed move: delivered moves q from reserved to sold, rejected and cancelled give q back to the listing, the rest change nothing; the invariant still holds, and the database's greatest(reserved − q, 0) never has to clamp.",
    (Z) => {
      const L = lifecycle(Z);
      const { s, rest, q } = setup(Z);
      const to = Z.Int.const("to");
      const actor = Z.Int.const("actor");
      const released = s.reserved.sub(q);
      const clamped = Z.If(released.ge(0), released, Z.Real.val(0)) as ZNum;
      const next = after(s, { reserved: Z.If(L.finished(to), clamped, s.reserved) as ZNum, sold: Z.If(L.delivered(to), s.sold.add(q), s.sold) as ZNum }, to);
      return {
        given: [invariant(Z, s, rest, q), s.st.lt(NONE), L.allowedZ(s.st, to, actor)],
        claim: Z.And(invariant(Z, next, rest, q), Z.Implies(L.finished(to), released.ge(0))),
        watch: { reserved: s.reserved, q },
      };
    },
  );

  const adjust = (kind: "restocked" | "spoiled" | "adjusted") => (Z: Context<P>) => {
    const { s, rest, q, avail } = setup(Z);
    const a = Z.Real.const("amount");
    const pre = kind === "restocked" ? [a.gt(0)] : kind === "spoiled" ? [a.gt(0), a.le(avail)] : [Z.Not(a.eq(0)), avail.add(a).ge(0)];
    const next = kind === "spoiled" ? after(s, { spoiled: s.spoiled.add(a) }) : after(s, { listed: s.listed.add(a) });
    return { given: [invariant(Z, s, rest, q), ...pre], claim: invariant(Z, next, rest, q), watch: { amount: a, listed: s.listed } };
  };
  t.theorem("O5a", "Restocking keeps every count right", "adjust_stock 'restocked' with q > 0 adds to listed; the invariant still holds.", adjust("restocked"));
  t.theorem("O5b", "Recording spoilage keeps every count right", "adjust_stock 'spoiled' with 0 < q ≤ available adds to spoiled; the invariant still holds.", adjust("spoiled"));
  t.theorem("O5c", "Corrections keep every count right", "adjust_stock 'adjusted' with q ≠ 0 and available + q ≥ 0 changes listed; the invariant still holds.", adjust("adjusted"));

  t.theorem(
    "O6",
    "A farmer's on-time count never passes their completed count",
    "Delivered: completed + 1 and on-time + (0 or 1); cancelled by the farmer: completed + 1; nothing else touches them. From on-time ≤ completed, it stays so (so trust stays ≤ 1).",
    (Z) => {
      const [c, o] = [Z.Int.const("completed"), Z.Int.const("onTime")];
      const onTime = Z.Bool.const("deliveredOnTime");
      const step = Z.Int.const("step"); // 0 delivered, 1 cancelled by the farmer, 2 anything else
      const c2 = Z.If(step.le(1), c.add(1), c);
      const o2 = Z.If(Z.And(step.eq(0), onTime), o.add(1), o);
      return { given: [c.ge(0), o.ge(0), o.le(c), step.ge(0), step.le(2)], claim: o2.le(c2), watch: { completed: c, onTime: o } as unknown as Record<string, ZNum> };
    },
  );
});

// ---------------------------------------------------------------- the database is the model
const FARM = { lat: 26.9, lng: 75.8 };
const KM_PER_DEG = (6371 * Math.PI) / 180;
const near = { lat: FARM.lat + 5 / KM_PER_DEG, lng: FARM.lng };
let db: PGlite;
let farmer: string;

async function listing(item: string, qty: number) {
  return as(db, farmer, async () =>
    (await rows<{ id: string }>(db, `insert into public.produce (item_id, category, name, unit, price_per_unit, qty_listed, min_order_qty) values ($1, 'others', '', 'kg', 30, $2, 1) returning id`, [item, qty]))[0].id,
  );
}
async function business() {
  return createUser(db, { role: "consumer", consumer_type: "industrial", full_name: "Business buyer" });
}
const delivery = JSON.stringify({ name: "Buyer", phone: "9000000000", line1: "1 Main Rd", village_city: "Jaipur", district: "Jaipur", state: "Rajasthan", pincode: "302001", lat: near.lat, lng: near.lng });
async function place(buyer: string, produceId: string, qty: number): Promise<string> {
  const r = await as(db, buyer, () => rows<{ r: { orders: { order_id: string }[] } }>(db, `select public.place_order($1::jsonb, $2::jsonb) as r`, [JSON.stringify([{ produce_id: produceId, quantity: qty }]), delivery]));
  return r[0].r.orders[0].order_id;
}
async function move(userId: string, orderId: string, to: Status): Promise<boolean> {
  try {
    await as(db, userId, () => db.query(`select public.update_order_status($1, $2::public.order_status)`, [orderId, to]));
    return true;
  } catch {
    return false;
  }
}
async function stockOf(id: string): Promise<Stock> {
  const r = (await rows<Record<string, string>>(db, `select qty_listed, qty_sold, qty_reserved, qty_spoiled from public.produce where id = $1`, [id]))[0];
  return { listed: Number(r.qty_listed), sold: Number(r.qty_sold), reserved: Number(r.qty_reserved), spoiled: Number(r.qty_spoiled) };
}

describe("the database is the model", () => {
  beforeAll(async () => {
    db = await freshDb();
    farmer = await createUser(db, { role: "farmer", full_name: "Model Farmer" });
    await as(db, farmer, () =>
      db.query(`insert into public.addresses (label, line1, village_city, district, state, pincode, lat, lng) values ('farm','Plot 1','Chomu','Jaipur','Rajasthan','303702',$1,$2)`, [FARM.lat, FARM.lng]),
    );
  }, 120_000);

  t.check("O7", "update_order_status allows exactly the moves in the model: all 8 × 8 statuses, for the farmer and the buyer", async () => {
    const p = await listing("garlic", 10_000);
    const buyer = await business();
    const differences: string[] = [];
    let tried = 0;
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        for (const actor of ["farmer", "buyer"] as const) {
          const order = await place(buyer, p, 1);
          await db.query(`update public.orders set status = $2::public.order_status where id = $1`, [order, from]);
          const ok = await move(actor === "farmer" ? farmer : buyer, order, to);
          tried++;
          if (ok !== allowed(from, to, actor)) differences.push(`${actor}: ${from} → ${to} (database ${ok ? "allows" : "refuses"})`);
        }
      }
    }
    return { passed: differences.length === 0, detail: `${tried} moves tried: ${differences.length ? differences.join("; ") : "the database and the model agree on every one"}` };
  });

  t.check(
    "O8",
    "400 random orders, status changes and stock corrections: the database's counts always match the model and the invariant",
    async () => {
      let seed = 3;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
      const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
      const r2 = (x: number) => Math.round(x * 100) / 100;
      // The database counts in exact decimals; keep the model in whole hundredths too.
      const exact = (s: Stock): Stock => ({ listed: r2(s.listed), sold: r2(s.sold), reserved: r2(s.reserved), spoiled: r2(s.spoiled) });
      const listings = [await listing("onion", 40), await listing("potato", 25)];
      const model = new Map<string, Stock>();
      for (const id of listings) model.set(id, await stockOf(id));
      const buyers = [await business(), await business()];
      const orders: { id: string; buyer: string; listing: string; q: number; status: Status }[] = [];
      const problems: string[] = [];
      const counts = { placed: 0, refused: 0, moves: 0, adjustments: 0 };

      for (let step = 0; step < 400 && problems.length === 0; step++) {
        const kind = rnd();
        if (kind < 0.35) {
          const l = pick(listings);
          const s = model.get(l)!;
          const q = r2(1 + rnd() * Math.max(1, available(s) * 1.3));
          const expectOk = q <= r2(available(s));
          let ok = true;
          let id = "";
          try {
            id = await place(pick(buyers), l, q);
          } catch {
            ok = false;
          }
          if (ok !== expectOk) problems.push(`step ${step}: order of ${q} with ${available(s)} available: database ${ok ? "accepted" : "refused"}`);
          if (ok) {
            const o = (await rows<{ buyer_id: string }>(db, `select buyer_id from public.orders where id = $1`, [id]))[0];
            orders.push({ id, buyer: o.buyer_id, listing: l, q, status: "placed" });
            model.set(l, exact({ ...s, reserved: s.reserved + q }));
            counts.placed++;
          } else counts.refused++;
        } else if (kind < 0.8 && orders.length) {
          const o = pick(orders);
          const to = pick(STATUSES);
          const actor = pick(["farmer", "buyer"] as const);
          const ok = await move(actor === "farmer" ? farmer : o.buyer, o.id, to);
          if (ok !== allowed(o.status, to, actor)) problems.push(`step ${step}: ${actor} ${o.status} → ${to}: database ${ok ? "allowed" : "refused"}`);
          if (ok) {
            model.set(o.listing, exact(applyMove(model.get(o.listing)!, to, o.q)));
            o.status = to;
            counts.moves++;
          }
        } else {
          const l = pick(listings);
          const type = pick(["restocked", "spoiled", "adjusted"] as const);
          const q = r2((rnd() - 0.3) * 20);
          const expected = applyAdjust(model.get(l)!, type, q);
          let ok = true;
          try {
            await as(db, farmer, () => db.query(`select public.adjust_stock($1, $2::public.ledger_type, $3)`, [l, type, q]));
          } catch {
            ok = false;
          }
          if (ok !== (expected !== null)) problems.push(`step ${step}: ${type} ${q}: database ${ok ? "accepted" : "refused"}`);
          if (ok && expected) {
            model.set(l, exact(expected));
            counts.adjustments++;
          }
        }
        for (const l of listings) {
          const actual = await stockOf(l);
          const m = model.get(l)!;
          const holding = r2(orders.filter((o) => o.listing === l && HOLDING.includes(o.status)).reduce((a, o) => a + o.q, 0));
          const delivered = r2(orders.filter((o) => o.listing === l && o.status === "delivered").reduce((a, o) => a + o.q, 0));
          const same = (["listed", "sold", "reserved", "spoiled"] as const).every((k) => Math.abs(actual[k] - m[k]) < 0.005);
          if (!same) problems.push(`step ${step}: database ${JSON.stringify(actual)} ≠ model ${JSON.stringify(m)}`);
          if (available(actual) < -0.005 || Math.abs(actual.reserved - holding) > 0.005) problems.push(`step ${step}: reserved ${actual.reserved} ≠ open orders ${holding}`);
          if (Math.abs(actual.sold - delivered) > 0.005) problems.push(`step ${step}: sold ${actual.sold} ≠ delivered ${delivered}`);
        }
      }
      return {
        passed: problems.length === 0,
        detail: problems.length
          ? problems.slice(0, 3).join("; ")
          : `${counts.placed} orders placed, ${counts.refused} refused for lack of stock, ${counts.moves} status changes, ${counts.adjustments} stock corrections: counts matched after every step`,
      };
    },
    600_000,
  );
});
