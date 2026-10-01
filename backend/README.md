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

Terraform zips `dist/` (`data.archive_file.api`), so `npm run build` must run before
`terraform plan`. The workflows do this automatically.

## Structure

```text
backend/
├── src/
│   ├── index.ts           Lambda entry point; routes by API Gateway route key
│   ├── config.ts          environment variables (ENVIRONMENT, LOG_LEVEL, APPLICATION_NAME)
│   ├── http.ts            JSON response helper
│   └── handlers/
│       └── health.ts      GET /health
├── tests/                 Vitest tests
├── build.mjs              esbuild bundling
└── eslint.config.js, tsconfig.json, vitest.config.ts
```

TICKET-008 extends this into the full layered structure (services, repositories, validators, …).

## Endpoints

| Route | Response |
|---|---|
| `GET /health` | `200 {"status":"ok","application":"tenner","environment":"prod"}` |
| anything else reaching the function | `404 {"success":false,"error":{"code":"NOT_FOUND",…}}` |

Unhandled errors return `500` with a generic message. Details are logged, never returned.
