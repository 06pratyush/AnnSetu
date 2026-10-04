import path from "node:path";
import { defineConfig } from "vitest/config";

// npm run prove: the theorems in proofs/ (Z3) and the checks that tie each model to the code.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["proofs/**/*.proof.ts"],
    testTimeout: 300_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
