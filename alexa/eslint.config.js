// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
  },
  // Only src/config.ts may read process.env (same rule as backend/).
  {
    files: ["src/**/*.ts"],
    ignores: ["src/config.ts"],
    rules: {
      "no-restricted-properties": ["error", { object: "process", property: "env", message: "Read configuration via src/config.ts." }],
    },
  },
);
