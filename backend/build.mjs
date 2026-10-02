// Bundles the Lambda handler into dist/index.mjs (single ESM file, Node.js 22).
import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // CommonJS dependencies inside an ESM bundle need require().
  banner: { js: "import { createRequire } from \"node:module\"; const require = createRequire(import.meta.url);" },
  sourcemap: false,
  minify: true,
  keepNames: true,
  legalComments: "none",
  // AWS SDK v3 is bundled (pinned in package-lock.json) instead of relying on the
  // runtime-provided version, so deployments are reproducible.
  logLevel: "info",
});
