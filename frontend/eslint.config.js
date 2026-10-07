// @ts-check
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  // Configuration: only src/config.ts may read import.meta.env (FRONTEND-001).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/config.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.type='MetaProperty'][property.name='env']",
          message: "Read configuration via src/config.ts.",
        },
      ],
    },
  },
  // API isolation: only src/api/ may call fetch (FRONTEND-001).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/api/**", "src/**/*.test.{ts,tsx}", "src/tests/**"],
    rules: {
      "no-restricted-globals": ["error", { name: "fetch", message: "Use the API client in src/api/." }],
    },
  },
  // Service worker extension (NOTIFICATION-009): plain JavaScript imported by the generated worker.
  {
    files: ["public/**/*.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  // Tests and test helpers may export non-components.
  {
    files: ["src/**/*.test.{ts,tsx}", "src/tests/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);
