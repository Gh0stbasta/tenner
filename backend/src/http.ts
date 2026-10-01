/** HTTP response helpers for API Gateway HTTP API (payload format 2.0). */

import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}
