/**
 * Lambda entry point for the Tenner API (function tenner-api).
 * Routes API Gateway HTTP API requests by route key to handlers.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { getDocumentClient, probeTables } from "./clients/dynamodb.js";
import { loadConfig, type AppConfig } from "./config.js";
import { health, type DatabaseProbe } from "./handlers/health.js";
import { jsonResponse } from "./http.js";
import { createLogger, type Logger } from "./utils/logger.js";

/** Dependencies shared by all handlers; replaced in tests. */
export interface Dependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly probeDatabase: DatabaseProbe;
}

type RouteHandler = (deps: Dependencies) => Promise<APIGatewayProxyStructuredResultV2>;

const ROUTES: Readonly<Record<string, RouteHandler>> = {
  "GET /health": (deps) => health(deps.config, deps.probeDatabase, deps.logger),
};

/** Build production dependencies once per container and log the startup configuration. */
export function createDependencies(config: AppConfig = loadConfig()): Dependencies {
  const logger = createLogger(config.logLevel);
  logger.info("Tenner API starting", {
    environment: config.environment,
    application: config.applicationName,
    tables: config.tables ?? "not configured",
  });
  return {
    config,
    logger,
    probeDatabase: (tables) => probeTables(getDocumentClient(), tables),
  };
}

let dependencies: Dependencies | undefined;

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  dependencies ??= createDependencies();
  return route(event, dependencies);
}

/** Dispatch a request to its handler. Exported for tests. */
export async function route(event: APIGatewayProxyEventV2, deps: Dependencies): Promise<APIGatewayProxyStructuredResultV2> {
  const requestId = event.requestContext?.requestId;
  const routeHandler = ROUTES[event.routeKey];

  if (!routeHandler) {
    deps.logger.warn("Route not found", { routeKey: event.routeKey, requestId });
    return jsonResponse(404, { success: false, error: { code: "NOT_FOUND", message: "Route not found." } });
  }

  try {
    const response = await routeHandler(deps);
    deps.logger.info("Request handled", { routeKey: event.routeKey, statusCode: response.statusCode, requestId });
    return response;
  } catch (error) {
    deps.logger.error("Unhandled error", { routeKey: event.routeKey, requestId, error: String(error) });
    return jsonResponse(500, { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } });
  }
}
