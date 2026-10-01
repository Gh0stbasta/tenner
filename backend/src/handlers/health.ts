/** GET /health: liveness check without dependencies. */

import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { AppConfig } from "../config.js";
import { jsonResponse } from "../http.js";

export interface HealthResponse {
  status: "ok";
  application: string;
  environment: string;
}

export function health(config: AppConfig): APIGatewayProxyStructuredResultV2 {
  const body: HealthResponse = {
    status: "ok",
    application: config.applicationName.toLowerCase(),
    environment: config.environment,
  };
  return jsonResponse(200, body);
}
