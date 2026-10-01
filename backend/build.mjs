// Bundles the Lambda handler into dist/index.mjs (single ESM file, Node.js 22, arm64-agnostic).
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
  sourcemap: false,
  minify: false,
  legalComments: "none",
  // Provided by the Lambda Node.js runtime.
  external: ["@aws-sdk/*"],
  logLevel: "info",
});
