// Checks every declared text/background pair in src/styles/tokens.css against WCAG 2.1 AA,
// in both themes. Run: npm run check:contrast
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");

function block(selectorStart) {
  const i = css.indexOf(selectorStart);
  if (i < 0) throw new Error(`block not found: ${selectorStart}`);
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  const vars = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) vars[m[1]] = m[2].trim();
  return vars;
}

const themes = {
  light: block(':root,\n[data-theme="light"]'),
  dark: { ...block(':root,\n[data-theme="light"]'), ...block('[data-theme="dark"] {') },
};

const lum = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, [backgrounds], minimum ratio]
const TEXT = 4.5;
const UI = 3;
const pairs = [
  ["ink", ["bg", "surface", "sunken", "khet-soft", "neel-soft", "haldi-soft"], TEXT],
  ["ink-muted", ["bg", "surface", "sunken"], TEXT],
  ["khet", ["bg", "surface", "khet-soft"], TEXT],
  ["on-khet", ["khet", "khet-hover"], TEXT],
  ["neel", ["bg", "surface", "neel-soft"], TEXT],
  ["on-neel", ["neel", "neel-hover"], TEXT],
  ["on-haldi", ["haldi", "haldi-hover"], TEXT],
  ["haldi-ink", ["haldi-soft", "bg", "surface"], TEXT],
  ["success", ["success-soft", "surface"], TEXT],
  ["warning", ["warning-soft", "surface"], TEXT],
  ["danger", ["danger-soft", "surface", "bg"], TEXT],
  ["on-danger", ["danger", "danger-hover"], TEXT],
  ["info", ["info-soft", "surface"], TEXT],
  ["border-strong", ["surface", "bg"], UI],
  ["focus", ["bg", "surface", "sunken", "khet-soft"], UI],
  ["chart-1", ["surface"], UI],
  ["chart-2", ["surface"], UI],
  ["chart-3", ["surface"], UI],
  ["chart-4", ["surface"], UI],
  ["chart-5", ["surface"], UI],
];

let failures = 0;
for (const [theme, vars] of Object.entries(themes)) {
  console.log(`\n${theme}`);
  for (const [fg, bgs, min] of pairs) {
    for (const bg of bgs) {
      const a = vars[fg];
      const b = vars[bg];
      if (!a?.startsWith("#") || !b?.startsWith("#")) {
        console.log(`  ??   ${fg} on ${bg}: missing value`);
        failures++;
        continue;
      }
      const r = ratio(a, b);
      const ok = r >= min;
      if (!ok) failures++;
      console.log(`  ${ok ? "ok  " : "FAIL"} ${fg.padEnd(14)} on ${bg.padEnd(13)} ${r.toFixed(2)}:1 (needs ${min})`);
    }
  }
}
console.log(failures ? `\n${failures} pair(s) below WCAG AA` : "\nAll pairs meet WCAG AA in both themes.");
process.exit(failures ? 1 : 0);
