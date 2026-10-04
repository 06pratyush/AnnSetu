// Daily mandi prices from Agmarknet (via data.gov.in) into reference_prices.
// Run by .github/workflows/prices.yml, or by hand:  npm run prices:fetch
//
// Needs (as GitHub Actions secrets, never in the browser or the repository):
//   DATA_GOV_IN_API_KEY        free key from https://data.gov.in (My Account → API key)
//   NEXT_PUBLIC_SUPABASE_URL   your project URL
//   SUPABASE_SERVICE_ROLE_KEY  the secret / service_role key; only this job writes prices
// PRICE_FEED_DRY_RUN=1 prints what would be written instead of writing.
//
// If the feed is down the job warns and leaves the last good prices in place; the engine keeps
// using a price for 30 days, then falls back to a wider area or to "no suggestion".
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_BASE, aggregate, buildCommodityIndex, parseRecord } from "./agmarknet.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogue = JSON.parse(readFileSync(path.join(root, "supabase/catalogue.json"), "utf8"));
const items = catalogue.items ?? catalogue;

const apiKey = process.env.DATA_GOV_IN_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.env.PRICE_FEED_DRY_RUN === "1";

const PAGE = 1000;
const MAX_PAGES = 60;
const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `warning: ${msg}`);

async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      return JSON.parse(text);
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw last;
}

async function fetchAll() {
  const records = [];
  let total = Infinity;
  for (let page = 0; page < MAX_PAGES && records.length < total; page++) {
    const url = `${API_BASE}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=${PAGE}&offset=${page * PAGE}`;
    const body = await getJson(url);
    if (body.status && body.status !== "ok") throw new Error(`data.gov.in said: ${body.message ?? body.status}`);
    const batch = body.records ?? [];
    total = Number(body.total ?? batch.length);
    records.push(...batch);
    if (batch.length < PAGE) break;
  }
  return records;
}

/** Upsert in chunks through PostgREST; the primary key (item, state, district, source) decides the row. */
async function upsert(rows) {
  // New-style secret keys (sb_secret_...) go in the apikey header only; legacy service_role JWTs also as Bearer.
  const headers = {
    apikey: serviceKey,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates,return=minimal",
    ...(serviceKey.startsWith("sb_") ? {} : { authorization: `Bearer ${serviceKey}` }),
  };
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${supabaseUrl}/rest/v1/reference_prices?on_conflict=item_id,state,district,source`, {
      method: "POST",
      headers,
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`Supabase refused the prices: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

async function main() {
  if (!apiKey) {
    warn("DATA_GOV_IN_API_KEY is not set, so no live prices were fetched. The engine keeps using the prices it has.");
    return;
  }
  if (!dryRun && (!supabaseUrl || !serviceKey)) {
    warn("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set, so prices can't be saved.");
    return;
  }

  let raw;
  try {
    raw = await fetchAll();
  } catch (err) {
    warn(`Agmarknet feed unavailable (${err.message}). Last good prices stay in place.`);
    return;
  }
  const index = buildCommodityIndex(items);
  const observations = raw.map((r) => parseRecord(r, index)).filter(Boolean);
  const rows = aggregate(observations);
  const itemsCovered = new Set(rows.map((r) => r.item_id)).size;
  console.log(`${raw.length} feed records, ${observations.length} usable, ${rows.length} area prices for ${itemsCovered} items`);
  if (!rows.length) {
    warn("The feed answered but had no usable prices for catalogue items today. Nothing changed.");
    return;
  }
  if (dryRun) {
    console.log(JSON.stringify(rows.filter((r) => r.state === "").slice(0, 80), null, 2));
    return;
  }
  await upsert(rows);
  console.log(`saved ${rows.length} prices`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
