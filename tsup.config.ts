import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync } from "node:fs";

/**
 * Build config for the published package.
 *
 * Three entry points map to the three `exports` paths in package.json:
 *   `.`         → dist/index.js          (the descriptor; consumer-facing)
 *   `./sandbox` → dist/sandbox-entry.js  (runtime entrypoint loaded by EmDash)
 *   `./astro`   → dist/astro/index.js    (block-components map for PT renderer)
 *
 * Astro components cannot be bundled — they have to ship as source so the
 * consumer's Astro build can process them. We mark `*.astro` external and
 * copy the single ContactForm.astro into dist/astro/ in the onSuccess hook.
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "sandbox-entry": "src/sandbox-entry.ts",
    "astro/index": "src/astro/index.ts",
  },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: false,
  target: "node18",
  // Don't bundle these — they stay as runtime imports.
  external: [/\.astro$/, "emdash"],
  onSuccess: async () => {
    mkdirSync("dist/astro", { recursive: true });
    copyFileSync(
      "src/astro/ContactForm.astro",
      "dist/astro/ContactForm.astro",
    );
  },
});
