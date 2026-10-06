// Bundles the Lambda handlers into single ESM files (Node.js 22): dist/index.mjs (API) and dist-notifier/index.mjs.
import { build } from "esbuild";
import { rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await rm("dist-notifier", { recursive: true, force: true });

// Two Lambdas from one package: the API (dist/) and the notifier (dist-notifier/, NOTIFICATION-001).
for (const [entry, outfile] of [
  ["src/index.ts", "dist/index.mjs"],
  ["src/notifier.ts", "dist-notifier/index.mjs"],
]) {
  await build({
    entryPoints: [entry],
    outfile,
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
}
