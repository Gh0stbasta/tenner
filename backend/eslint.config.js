// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "dist-notifier/", "coverage/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
  },
  // Configuration framework: only src/config.ts may read process.env (TICKET-008).
  {
    files: ["src/**/*.ts"],
    ignores: ["src/config.ts"],
    rules: {
      "no-restricted-properties": ["error", { object: "process", property: "env", message: "Read configuration via src/config.ts." }],
    },
  },
  // Layering: handlers and services must not touch DynamoDB directly (TICKET-008).
  {
    files: ["src/handlers/**/*.ts", "src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@aws-sdk/*"], message: "Use a repository instead of the AWS SDK." },
            { group: ["**/clients/*"], message: "Use a repository instead of infrastructure clients." },
          ],
        },
      ],
    },
  },
);
