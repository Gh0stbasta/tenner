/**
 * Lambda entry point for the Tenner API (function tenner-api).
 * Routes API Gateway HTTP API requests by route key to handlers and maps errors to the
 * standard error response.
 */

import { getDocumentClient, probeTables } from "./clients/dynamodb.js";
import { loadConfig, type AppConfig } from "./config.js";
import { ApplicationError, NotFoundError } from "./exceptions/index.js";
import { createTennerHandler, type CreateTenner } from "./handlers/create-tenner.js";
import { health, type DatabaseProbe } from "./handlers/health.js";
import { listTennersHandler, type ListTenners } from "./handlers/list-tenners.js";
import { DynamoDbTennerRepository } from "./repositories/index.js";
import { CreateTennerService, ListTennersService } from "./services/index.js";
import { systemClock, uuidGenerator } from "./utils/clock.js";
import type { ApiEvent, ApiResult } from "./types/api.js";
import { errorResponse } from "./utils/http.js";
import { createLogger, errorFields, type Logger } from "./utils/logger.js";

/** Dependencies shared by all handlers; replaced in tests. */
export interface Dependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly probeDatabase: DatabaseProbe;
  readonly createTenner: CreateTenner;
  readonly listTenners: ListTenners;
}

/** Per-request context passed to route handlers. */
export interface RequestContext {
  readonly event: ApiEvent;
  readonly deps: Dependencies;
  /** Logger bound to the request's correlationId. */
  readonly logger: Logger;
}

type RouteHandler = (ctx: RequestContext) => Promise<ApiResult>;

const ROUTES: Readonly<Record<string, RouteHandler>> = {
  "GET /health": ({ deps, logger }) => health(deps.config, deps.probeDatabase, logger),
  "POST /tenners": ({ event, deps, logger }) => createTennerHandler(event, deps.config.tenantId, deps.createTenner, logger),
  "GET /tenners": ({ event, deps, logger }) => listTennersHandler(event, deps.config.tenantId, deps.listTenners, logger),
};

const CORRELATION_HEADER = "x-correlation-id";

/** Build production dependencies once per container and log the startup configuration. */
export function createDependencies(config: AppConfig = loadConfig()): Dependencies {
  const logger = createLogger(config.logLevel);
  logger.info("Tenner API starting", {
    environment: config.environment,
    application: config.applicationName,
    tables: config.tables ?? "not configured",
  });
  const tables = config.tables;
  const notConfigured = async (): Promise<never> => {
    throw new ApplicationError("SERVICE_UNAVAILABLE", 503, "Service is not configured.");
  };
  const tennerRepository = tables ? new DynamoDbTennerRepository(getDocumentClient(), tables.tenners) : undefined;
  const createTennerService = tennerRepository ? new CreateTennerService(tennerRepository, systemClock, uuidGenerator) : undefined;
  const listTennersService = tennerRepository ? new ListTennersService(tennerRepository, systemClock) : undefined;

  return {
    config,
    logger,
    probeDatabase: (t) => probeTables(getDocumentClient(), t),
    createTenner: createTennerService ? (tenantId, request) => createTennerService.createTenner(tenantId, request) : notConfigured,
    listTenners: listTennersService ? (tenantId, request) => listTennersService.listTenners(tenantId, request) : notConfigured,
  };
}

let dependencies: Dependencies | undefined;

export async function handler(event: ApiEvent): Promise<ApiResult> {
  dependencies ??= createDependencies();
  return route(event, dependencies);
}

/** Correlation ID: client-provided header (if sane) or the API Gateway request ID. */
export function correlationIdOf(event: ApiEvent): string {
  const header = event.headers?.[CORRELATION_HEADER];
  if (header && /^[A-Za-z0-9._-]{1,128}$/.test(header)) return header;
  return event.requestContext?.requestId ?? "unknown";
}

/** Dispatch a request to its handler. Exported for tests. */
export async function route(event: ApiEvent, deps: Dependencies): Promise<ApiResult> {
  const correlationId = correlationIdOf(event);
  const logger = deps.logger.child({ correlationId, routeKey: event.routeKey });
  const withCorrelation = (result: ApiResult): ApiResult => ({
    ...result,
    headers: { ...result.headers, [CORRELATION_HEADER]: correlationId },
  });

  try {
    const routeHandler = ROUTES[event.routeKey];
    if (!routeHandler) throw new NotFoundError("Route not found.");
    const response = await routeHandler({ event, deps, logger });
    logger.info("Request handled", { statusCode: response.statusCode });
    return withCorrelation(response);
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof ApplicationError && error.statusCode < 500) {
      logger.warn("Request rejected", { statusCode: response.statusCode, errorCode: error.code });
    } else {
      logger.error("Request failed", { statusCode: response.statusCode, ...errorFields(error) });
    }
    return withCorrelation(response);
  }
}
