/** GET /health: runtime, configuration and DynamoDB connectivity check. */

import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { AppConfig, TableConfig } from "../config.js";
import { jsonResponse } from "../http.js";
import type { Logger } from "../utils/logger.js";

export type DatabaseStatus = "connected" | "unreachable" | "misconfigured";

export interface HealthResponse {
  status: "ok" | "error";
  application: string;
  environment: string;
  database: DatabaseStatus;
}

/** Returns true if all tables are reachable. */
export type DatabaseProbe = (tables: TableConfig) => Promise<boolean>;

export async function health(config: AppConfig, probe: DatabaseProbe, logger: Logger): Promise<APIGatewayProxyStructuredResultV2> {
  const database = await databaseStatus(config, probe);
  const healthy = database === "connected";
  if (!healthy) {
    logger.error("Health check failed", { database });
  }

  const body: HealthResponse = {
    status: healthy ? "ok" : "error",
    application: config.applicationName.toLowerCase(),
    environment: config.environment,
    database,
  };
  return jsonResponse(healthy ? 200 : 503, body);
}

async function databaseStatus(config: AppConfig, probe: DatabaseProbe): Promise<DatabaseStatus> {
  if (!config.tables) return "misconfigured";
  return (await probe(config.tables)) ? "connected" : "unreachable";
}
