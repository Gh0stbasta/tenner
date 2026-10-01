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
);
