// Fails if English and Hindi translations drift apart, or if code uses a key that doesn't exist.
// Run: npm run check:i18n
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load = (l) => JSON.parse(readFileSync(path.join(root, `src/locales/${l}.json`), "utf8"));
const flat = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));

const en = new Set(flat(load("en")));
const hi = new Set(flat(load("hi")));
let problems = 0;
for (const k of en) {
  if (!hi.has(k)) {
    problems++;
    console.log(`missing in hi: ${k}`);
  }
}
for (const k of hi) {
  if (!en.has(k)) {
    problems++;
    console.log(`missing in en: ${k}`);
  }
}

// Static keys used in code: t("a.b") / t('a.b'). Dynamic keys (template strings) are skipped.
const base = (k) => k.replace(/_(one|other)$/, "");
const known = new Set([...en].map(base));
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f)) {
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g)) {
        if (!known.has(m[1])) {
          problems++;
          console.log(`unknown key ${m[1]} in ${path.relative(root, p)}`);
        }
      }
    }
  }
}
walk(path.join(root, "src"));
console.log(problems ? `\n${problems} i18n problem(s)` : `i18n ok: ${en.size} keys in both languages`);
process.exit(problems ? 1 : 0);
