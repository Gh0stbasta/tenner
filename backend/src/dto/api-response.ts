/** Standard API response envelope. */

import type { ErrorDetail } from "../exceptions/index.js";

export interface SuccessResponse<T> {
  readonly success: true;
  readonly data: T;
}

export interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
}

export interface ErrorResponse {
  readonly success: false;
  readonly error: ErrorBody;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function successBody<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

export function errorBody(code: string, message: string, details?: readonly ErrorDetail[]): ErrorResponse {
  return { success: false, error: details?.length ? { code, message, details } : { code, message } };
}
