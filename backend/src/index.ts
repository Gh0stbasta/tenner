/**
 * Lambda entry point for the Tenner API (function tenner-api).
 * Routes API Gateway HTTP API requests by route key to handlers.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { loadConfig, type AppConfig } from "./config.js";
import { health } from "./handlers/health.js";
import { jsonResponse } from "./http.js";

type RouteHandler = (config: AppConfig) => APIGatewayProxyStructuredResultV2;

const ROUTES: Readonly<Record<string, RouteHandler>> = {
  "GET /health": health,
};

const config = loadConfig();

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  return route(event, config);
}

/** Dispatch a request to its handler. Exported for tests. */
export function route(event: APIGatewayProxyEventV2, appConfig: AppConfig): APIGatewayProxyStructuredResultV2 {
  const requestId = event.requestContext?.requestId;
  const routeHandler = ROUTES[event.routeKey];

  if (!routeHandler) {
    console.warn(JSON.stringify({ message: "Route not found", routeKey: event.routeKey, requestId }));
    return jsonResponse(404, { success: false, error: { code: "NOT_FOUND", message: "Route not found." } });
  }

  try {
    const response = routeHandler(appConfig);
    console.info(JSON.stringify({ message: "Request handled", routeKey: event.routeKey, statusCode: response.statusCode, requestId }));
    return response;
  } catch (error) {
    console.error(JSON.stringify({ message: "Unhandled error", routeKey: event.routeKey, requestId, error: String(error) }));
    return jsonResponse(500, { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error." } });
  }
}
