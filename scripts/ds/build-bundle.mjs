// Builds the design-system bundle from the app's real components:
//   design-system/project/components/bundle.js   (one classic script, window.AnnSetu, React 18 globals)
//   design-system/project/components/bundle.css  (Tailwind output for the components + tokens + fonts)
// Run: npm run ds:bundle
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { reactGlobals } from "../../design-system/src/shims/react-globals.mjs";
import { COMPONENTS } from "./components.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "design-system/project/components");
mkdirSync(out, { recursive: true });

const result = await esbuild.build({
  entryPoints: [path.join(root, "design-system/src/entry.tsx")],
  bundle: true,
  format: "iife",
  globalName: "AnnSetu",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  jsx: "automatic",
  write: false,
  tsconfig: path.join(root, "tsconfig.json"),
  alias: { "next/link": path.join(root, "design-system/src/shims/link.tsx") },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_BASE_PATH": '""',
  },
  plugins: [reactGlobals],
  logLevel: "warning",
  logOverride: { "unsupported-dynamic-import": "silent" },
});

let js = result.outputFiles[0].text;
if (/<\/script|<!--/i.test(js)) {
  js = js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "\\x3C!--");
  if (/<\/script|<!--/i.test(js)) throw new Error("bundle.js still contains </script or <!--");
}
const header = `/* @ds-bundle: ${JSON.stringify({ format: 4, namespace: "AnnSetu", components: COMPONENTS.map((c) => ({ name: c.name })) })} */\n`;
writeFileSync(path.join(out, "bundle.js"), header + js);

// Tailwind: compile the app's globals.css, scanning the components and the previews.
const input = path.join(root, "design-system/src/bundle-input.css");
writeFileSync(
  input,
  `@import "../../src/app/globals.css";\n@source "../../src/components";\n@source "../project/components";\n`,
);
const tmp = path.join(root, "design-system/src/.bundle.tmp.css");
execFileSync(process.execPath, [path.join(root, "node_modules/@tailwindcss/cli/dist/index.mjs"), "-i", input, "-o", tmp, "--minify"], {
  cwd: root,
  stdio: "inherit",
});
const fonts =
  '@import url("https://fonts.googleapis.com/css2?family=Anek+Devanagari:wdth,wght@75..125,400..800&family=Mukta:wght@400;500;600;700&display=swap");\n';
const cssBody = readFileSync(tmp, "utf8");
if (/<\/style/i.test(cssBody)) throw new Error("bundle.css contains </style");
writeFileSync(path.join(out, "bundle.css"), fonts + cssBody);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
console.log(`bundle.js ${kb(header + js)}, bundle.css ${kb(fonts + cssBody)}`);
