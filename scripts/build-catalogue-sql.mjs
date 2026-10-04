// Writes supabase/migrations/20261005000002_catalogue_seed.sql from supabase/catalogue.json:
// the items, every spelling, and clearly labelled sample prices. Run: npm run db:catalogue
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { items } = JSON.parse(readFileSync(path.join(root, "supabase/catalogue.json"), "utf8"));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (a) => (a.length ? `array[${a.map(q).join(", ")}]` : "'{}'::text[]");

const lines = [
  "-- Item catalogue and sample prices. Generated from supabase/catalogue.json by scripts/build-catalogue-sql.mjs.",
  "-- Shelf lives are rough estimates for ambient storage; replace them with published storage tables.",
  "",
  "insert into public.items (id, category, name_en, name_hi, base_unit, shelf_life_hours, agmarknet_names, sort) values",
  items
    .map((i, n) => `  (${q(i.id)}, ${q(i.category)}, ${q(i.en)}, ${q(i.hi)}, ${q(i.unit)}, ${i.shelf_life_hours}, ${arr(i.agmarknet)}, ${n})`)
    .join(",\n") + ";",
  "",
  "insert into public.item_names (item_id, name) values",
  items
    .flatMap((i) => Array.from(new Set([i.en, i.hi, ...i.names].map((s) => s.trim().toLowerCase()))).map((name) => `  (${q(i.id)}, ${q(name)})`))
    .join(",\n") + "\non conflict do nothing;",
  "",
  "-- Illustrative national prices, marked source = 'sample', so the rate suggestion and the price score",
  "-- work before the live mandi feed runs. Live or manual prices always win over these.",
  "insert into public.reference_prices (item_id, state, district, source, price_date, mandi_price) values",
  items.map((i) => `  (${q(i.id)}, '', '', 'sample', date '2026-10-01', ${i.sample_mandi})`).join(",\n") + ";",
  "",
];
writeFileSync(path.join(root, "supabase/migrations/20261005000002_catalogue_seed.sql"), lines.join("\n"));
console.log(`catalogue seed: ${items.length} items`);
