// Reads src/styles/tokens.css (the single source of truth) and writes:
//   design-system/project/tokens.json   (the AnnSetu Design System artifact's token file)
//   src/styles/tokens.generated.json    (data for the in-app /design-system page)
// Run: npm run ds:tokens
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(path.join(root, "src/styles/tokens.css"), "utf8");

function blockAfter(marker) {
  const i = css.indexOf(marker);
  if (i < 0) throw new Error(`missing block: ${marker}`);
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  const out = [];
  for (const line of css.slice(open + 1, close).split("\n")) {
    const m = /--([a-z0-9-]+):\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?/i.exec(line);
    if (m) out.push({ name: m[1], value: m[2].trim(), usage: m[3] ?? "" });
  }
  return out;
}

const light = blockAfter(':root,\n[data-theme="light"] {');
const dark = Object.fromEntries(blockAfter('[data-theme="dark"] {').map((t) => [t.name, t.value]));
const roleBlock = blockAfter(':root,\n[data-role="farmer"] {');
const buyerRole = Object.fromEntries(blockAfter('[data-role="buyer"] {').map((t) => [t.name, t.value]));
const staticBlock = blockAfter("/* Type families, spacing, radius: theme-independent */\n:root {");

const isColor = (v) => /^#|^rgba?\(/.test(v);
const colors = light.filter((t) => isColor(t.value)).map((t) => ({
  name: t.name,
  value: { light: t.value.toLowerCase(), dark: (dark[t.name] ?? t.value).toLowerCase() },
  usage: t.usage,
}));
const roleUsage = {
  role: "Chrome color of the current side: primary buttons, selected nav, checked controls.",
  "role-hover": "Hover state of role fills.",
  "role-soft": "Tint of the current side: nav highlight, selected cards.",
  "on-role": "Text and icons on role fills.",
};
for (const r of roleBlock) {
  const target = /var\(--([a-z0-9-]+)\)/.exec(r.value)?.[1];
  const buyerTarget = /var\(--([a-z0-9-]+)\)/.exec(buyerRole[r.name] ?? "")?.[1];
  if (target) colors.push({ name: r.name, value: `{${target}}`, usage: `${roleUsage[r.name]} Farmer area: ${target}; buyer area: ${buyerTarget}.` });
}

const shadows = light
  .filter((t) => t.name.startsWith("shadow-"))
  .map((t) => ({ name: t.name, value: { light: t.value, dark: dark[t.name] ?? t.value }, usage: t.usage }));
const spacing = staticBlock.filter((t) => t.name.startsWith("space-")).map(({ name, value, usage }) => ({ name, value, usage }));
const radius = staticBlock.filter((t) => t.name.startsWith("radius-")).map(({ name, value, usage }) => ({ name, value, usage }));

const families = {
  display: '"Anek Devanagari", "Mukta", system-ui, sans-serif',
  body: '"Mukta", "Noto Sans Devanagari", system-ui, sans-serif',
};
const typeGroups = [
  {
    name: "Display",
    family: "display",
    styles: [
      { name: "display", fontSize: "2.5rem", lineHeight: 1.1, fontWeight: 700, sample: "जो उगाएँ, वो बेचें", usage: "Landing headline only; 3.25rem from the sm breakpoint." },
      { name: "h1", fontSize: "1.75rem", lineHeight: 1.2, fontWeight: 700, sample: "My produce", usage: "Page titles; 2rem from sm." },
      { name: "h2", fontSize: "1.375rem", lineHeight: 1.3, fontWeight: 600, sample: "In demand", usage: "Section and dialog titles." },
      { name: "h3", fontSize: "1.125rem", lineHeight: 1.35, fontWeight: 600, sample: "Tomato · Desi", usage: "Card titles, listing names, counterpart names on orders." },
      { name: "kpi", fontSize: "2.25rem", lineHeight: 1.1, fontWeight: 600, sample: "₹1.2L", usage: "Stat tile values, semi-condensed (wdth 85), proportional figures." },
    ],
  },
  {
    name: "Text",
    family: "body",
    styles: [
      { name: "body-lg", fontSize: "1.125rem", lineHeight: 1.6, fontWeight: 400, sample: "Grown without chemical fertiliser.", usage: "Farmer-facing forms and lead paragraphs." },
      { name: "body", fontSize: "1rem", lineHeight: 1.65, fontWeight: 400, sample: "Pay the farmer in cash when your order arrives.", usage: "Default text. Hindi pages run at line-height 1.7." },
      { name: "small", fontSize: "0.875rem", lineHeight: 1.55, fontWeight: 400, sample: "Accurate to about 12 m", usage: "Hints, meta lines, legends, table cells." },
      { name: "label", fontSize: "0.8125rem", lineHeight: 1.4, fontWeight: 600, sample: "On sale", usage: "Badges, eyebrows, column headers. Uppercase only in English." },
    ],
  },
];

const tokens = {
  name: "AnnSetu",
  version: 1,
  meta: {
    source: "github",
    repo: "06pratyush/AnnSetu",
    ref: process.env.DS_REF ?? "main",
    paths: { tokens: ["src/styles/tokens.css", "src/app/globals.css"], docs: ["design-system/project/README.md", "scripts/ds/components.mjs"] },
    synced: new Date().toISOString().slice(0, 10),
  },
  color: { themes: [{ id: "light", name: "Light" }, { id: "dark", name: "Dark" }], tokens: colors },
  type: { fonts: [], families, groups: typeGroups },
  spacing: { tokens: spacing },
  radius: { tokens: radius },
  shadow: { tokens: shadows },
};

mkdirSync(path.join(root, "design-system/project"), { recursive: true });
writeFileSync(path.join(root, "design-system/project/tokens.json"), JSON.stringify(tokens, null, 2) + "\n");
writeFileSync(path.join(root, "src/styles/tokens.generated.json"), JSON.stringify({ colors, spacing, radius, shadows, typeGroups }, null, 2) + "\n");
console.log(`tokens: ${colors.length} colors, ${spacing.length} spacing, ${radius.length} radii, ${shadows.length} shadows, ${typeGroups.reduce((n, g) => n + g.styles.length, 0)} type styles`);
