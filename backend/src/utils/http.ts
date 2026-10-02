/** HTTP response helpers for API Gateway HTTP API (payload format 2.0). */

import { errorBody, successBody } from "../dto/index.js";
import { ApplicationError } from "../exceptions/index.js";
import type { ApiResult } from "../types/api.js";

const JSON_HEADERS = {
  "content-type": "application/json",
  "cache-control": "no-store",
} as const;

export function jsonResponse(statusCode: number, body: unknown, headers: Record<string, string> = {}): ApiResult {
  return { statusCode, headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) };
}

/** 2xx response with the standard success envelope. */
export function successResponse<T>(statusCode: number, data: T): ApiResult {
  return jsonResponse(statusCode, successBody(data));
}

/**
 * Map any thrown value to an error response. ApplicationErrors keep their code, status,
 * message and details. Anything else becomes a generic 500 without internal information.
 */
export function errorResponse(error: unknown): ApiResult {
  if (error instanceof ApplicationError && error.statusCode < 500) {
    return jsonResponse(error.statusCode, errorBody(error.code, error.message, error.details));
  }
  if (error instanceof ApplicationError) {
    return jsonResponse(error.statusCode, errorBody(error.code, error.message));
  }
  return jsonResponse(500, errorBody("INTERNAL_ERROR", "Internal server error."));
}
