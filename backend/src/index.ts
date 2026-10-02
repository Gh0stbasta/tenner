/**
 * Lambda entry point for the Tenner API (function tenner-api).
 * Routes API Gateway HTTP API requests by route key to handlers and maps errors to the
 * standard error response.
 */

import { identityFromEvent, type Identity } from "./auth/index.js";
import { getDocumentClient, probeTables } from "./clients/dynamodb.js";
import { loadConfig, type AppConfig } from "./config.js";
import { ApplicationError, NotFoundError } from "./exceptions/index.js";
import { completeTennerHandler, type CompleteTenner } from "./handlers/complete-tenner.js";
import { createTennerHandler, type CreateTenner } from "./handlers/create-tenner.js";
import { dashboardHandler, type GetDashboard } from "./handlers/dashboard.js";
import { deleteTennerHandler, type DeleteTenner } from "./handlers/delete-tenner.js";
import { getTennerHandler, type GetTenner } from "./handlers/get-tenner.js";
import { health, type DatabaseProbe } from "./handlers/health.js";
import { historyHandler, tennerHistoryHandler, type GetHistory, type GetTennerHistory } from "./handlers/history.js";
import { listTennersHandler, type ListTenners } from "./handlers/list-tenners.js";
import { restoreTennerHandler, type RestoreTenner } from "./handlers/restore-tenner.js";
import { undoCompletionHandler, type UndoCompletion } from "./handlers/undo-completion.js";
import { updateTennerHandler, type UpdateTenner } from "./handlers/update-tenner.js";
import { DynamoDbCompletionRepository, DynamoDbTennerRepository } from "./repositories/index.js";
import {
  CompleteTennerService,
  CreateTennerService,
  DashboardService,
  DeleteTennerService,
  GetTennerService,
  HistoryService,
  ListTennersService,
  RestoreTennerService,
  UndoCompletionService,
  UpdateTennerService,
} from "./services/index.js";
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
  readonly updateTenner: UpdateTenner;
  readonly deleteTenner: DeleteTenner;
  readonly completeTenner: CompleteTenner;
  readonly undoCompletion: UndoCompletion;
  readonly restoreTenner: RestoreTenner;
  readonly getDashboard: GetDashboard;
  readonly getTenner: GetTenner;
  readonly getHistory: GetHistory;
  readonly getTennerHistory: GetTennerHistory;
}

/** Per-request context passed to route handlers. */
export interface RequestContext {
  readonly event: ApiEvent;
  readonly deps: Dependencies;
  /** Logger bound to the request's correlationId (and, on protected routes, the acting user). */
  readonly logger: Logger;
}

/** Context of a protected route: additionally carries the identity from the verified JWT claims (SECURITY-004). */
export interface AuthenticatedContext extends RequestContext {
  readonly identity: Identity;
}

type RouteHandler = (ctx: AuthenticatedContext) => Promise<ApiResult>;
type PublicRouteHandler = (ctx: RequestContext) => Promise<ApiResult>;

/** Routes without authentication; must match api_public_routes in terraform/locals.tf. */
const PUBLIC_ROUTES: Readonly<Record<string, PublicRouteHandler>> = {
  "GET /health": ({ deps, logger }) => health(deps.config, deps.probeDatabase, logger),
};

/** Protected routes. The tenant comes only from the identity; there is no default tenant. */
const ROUTES: Readonly<Record<string, RouteHandler>> = {
  "POST /tenners": ({ event, deps, logger, identity }) => createTennerHandler(event, identity, deps.createTenner, logger),
  "GET /tenners": ({ event, deps, logger, identity }) => listTennersHandler(event, identity.tenantId, deps.listTenners, logger),
  "GET /tenners/{tennerId}": ({ event, deps, logger, identity }) => getTennerHandler(event, identity.tenantId, deps.getTenner, logger),
  "GET /history": ({ event, deps, logger, identity }) => historyHandler(event, identity.tenantId, deps.getHistory, logger),
  "GET /tenners/{tennerId}/history": ({ event, deps, logger, identity }) => tennerHistoryHandler(event, identity.tenantId, deps.getTennerHistory, logger),
  "PUT /tenners/{tennerId}": ({ event, deps, logger, identity }) => updateTennerHandler(event, identity, deps.updateTenner, logger),
  "DELETE /tenners/{tennerId}": ({ event, deps, logger, identity }) => deleteTennerHandler(event, identity, deps.deleteTenner, logger),
  "POST /tenners/{tennerId}/complete": ({ event, deps, logger, identity }) => completeTennerHandler(event, identity, deps.completeTenner, logger),
  "POST /tenners/{tennerId}/undo-completion": ({ event, deps, logger, identity }) => undoCompletionHandler(event, identity, deps.undoCompletion, logger),
  "POST /tenners/{tennerId}/restore": ({ event, deps, logger, identity }) => restoreTennerHandler(event, identity, deps.restoreTenner, logger),
  "GET /dashboard": ({ event, deps, logger, identity }) => dashboardHandler(event, identity.tenantId, deps.getDashboard, logger),
};

const CORRELATION_HEADER = "x-correlation-id";

/** Build production dependencies once per container and log the startup configuration. */
export function createDependencies(config: AppConfig = loadConfig()): Dependencies {
  const logger = createLogger(config.logLevel);
  logger.info("Tenner API starting", {
    environment: config.environment,
    application: config.applicationName,
    timezone: config.timezone,
    tables: config.tables ?? "not configured",
  });
  const tables = config.tables;
  const notConfigured = async (): Promise<never> => {
    throw new ApplicationError("SERVICE_UNAVAILABLE", 503, "Service is not configured.");
  };
  const tennerRepository = tables ? new DynamoDbTennerRepository(getDocumentClient(), tables.tenners, tables.history) : undefined;
  const completionRepository = tables ? new DynamoDbCompletionRepository(getDocumentClient(), tables.history) : undefined;
  const createTennerService = tennerRepository ? new CreateTennerService(tennerRepository, systemClock, uuidGenerator) : undefined;
  const listTennersService = tennerRepository ? new ListTennersService(tennerRepository, systemClock) : undefined;
  const getTennerService = tennerRepository ? new GetTennerService(tennerRepository) : undefined;
  const historyService = tennerRepository && completionRepository ? new HistoryService(completionRepository, tennerRepository) : undefined;
  const updateTennerService = tennerRepository ? new UpdateTennerService(tennerRepository, systemClock) : undefined;
  const deleteTennerService = tennerRepository ? new DeleteTennerService(tennerRepository, systemClock) : undefined;
  const restoreTennerService = tennerRepository ? new RestoreTennerService(tennerRepository, systemClock) : undefined;
  const dashboardService = tennerRepository ? new DashboardService(tennerRepository, systemClock, config.timezone) : undefined;
  const completeTennerService =
    tennerRepository && completionRepository ? new CompleteTennerService(tennerRepository, completionRepository, systemClock, uuidGenerator) : undefined;
  const undoCompletionService = tennerRepository && completionRepository ? new UndoCompletionService(tennerRepository, completionRepository, systemClock) : undefined;

  return {
    config,
    logger,
    probeDatabase: (t) => probeTables(getDocumentClient(), t),
    createTenner: createTennerService ? (identity, request) => createTennerService.createTenner(identity, request) : notConfigured,
    listTenners: listTennersService ? (tenantId, request) => listTennersService.listTenners(tenantId, request) : notConfigured,
    updateTenner: updateTennerService ? (identity, id, request) => updateTennerService.updateTenner(identity, id, request) : notConfigured,
    deleteTenner: deleteTennerService ? (identity, id) => deleteTennerService.deleteTenner(identity, id) : notConfigured,
    restoreTenner: restoreTennerService ? (identity, id) => restoreTennerService.restoreTenner(identity, id) : notConfigured,
    getHistory: historyService ? (tenantId, request) => historyService.getHistory(tenantId, request) : notConfigured,
    getTennerHistory: historyService ? (tenantId, id, request) => historyService.getTennerHistory(tenantId, id, request) : notConfigured,
    getTenner: getTennerService ? (tenantId, id, options) => getTennerService.getTenner(tenantId, id, options) : notConfigured,
    getDashboard: dashboardService ? (tenantId, request) => dashboardService.getDashboard(tenantId, request) : notConfigured,
    completeTenner: completeTennerService
      ? (identity, id, request, key) => completeTennerService.completeTenner(identity, id, request, key)
      : notConfigured,
    undoCompletion: undoCompletionService
      ? (identity, id, request, key) => undoCompletionService.undoLatestCompletion(identity, id, request, key)
      : notConfigured,
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

/** Public routes run without identity; protected routes first resolve the identity from the JWT claims. */
async function dispatch(event: ApiEvent, deps: Dependencies, requestLogger: Logger): Promise<ApiResult> {
  const publicHandler = PUBLIC_ROUTES[event.routeKey];
  if (publicHandler) return publicHandler({ event, deps, logger: requestLogger });
  const routeHandler = ROUTES[event.routeKey];
  if (!routeHandler) throw new NotFoundError("Route not found.");
  const identity = identityFromEvent(event);
  return routeHandler({ event, deps, identity, logger: requestLogger.child({ userId: identity.userId }) });
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
    const response = await dispatch(event, deps, logger);
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
