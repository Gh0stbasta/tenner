# Tenner Backend

TypeScript code for the `tenner-api` Lambda function (Node.js 22, arm64), behind an
API Gateway HTTP API.

## Commands

```bash
npm ci
npm run lint        # ESLint (typescript-eslint strict)
npm test            # Vitest with coverage (threshold 80%)
npm run build       # type check + esbuild bundle → dist/index.mjs
```

Runtime dependencies: `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`. They are bundled, not taken from the Lambda runtime.

Terraform zips `dist/` (`data.archive_file.api`), so `npm run build` must run before
`terraform plan`. The workflows do this automatically.

## Structure

```text
backend/
├── src/
│   ├── index.ts           Lambda entry point; routes by API Gateway route key
│   ├── config.ts          environment variables (ENVIRONMENT, LOG_LEVEL, APPLICATION_NAME,
│   │                      TENNERS_TABLE, HISTORY_TABLE)
│   ├── http.ts            JSON response helper
│   ├── clients/
│   │   └── dynamodb.ts    shared DocumentClient, table connectivity probe
│   ├── utils/
│   │   └── logger.ts      structured JSON logger
│   └── handlers/
│       └── health.ts      GET /health (runtime, configuration, DynamoDB)
├── tests/                 Vitest tests
├── build.mjs              esbuild bundling
└── eslint.config.js, tsconfig.json, vitest.config.ts
```

TICKET-008 extends this into the full layered structure (services, repositories, validators, …).

## Endpoints

| Route | Response |
|---|---|
| `GET /health` | `200 {"status":"ok","application":"tenner","environment":"prod","database":"connected"}`. Returns `503` with `"status":"error"` and `database` `unreachable` or `misconfigured` |
| anything else reaching the function | `404 {"success":false,"error":{"code":"NOT_FOUND",…}}` |

Unhandled errors return `500` with a generic message. Details are logged, never returned.
