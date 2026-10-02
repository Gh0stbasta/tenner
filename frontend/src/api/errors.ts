/** Errors raised by the API client (FRONTEND-001). */

export interface ApiErrorDetail {
  readonly field?: string;
  readonly message: string;
}

/** Codes produced by the client itself (not by the backend). */
export const CLIENT_ERROR_CODES = {
  network: "NETWORK_ERROR",
  invalidResponse: "INVALID_RESPONSE",
  notConfigured: "API_NOT_CONFIGURED",
} as const;

export class ApiError extends Error {
  constructor(
    /** HTTP status; 0 if no response was received. */
    readonly status: number,
    /** Backend error code (e.g. NOT_FOUND) or a client code from CLIENT_ERROR_CODES. */
    readonly code: string,
    message: string,
    readonly details: readonly ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True for errors that a retry may fix: network failures, 5xx and throttling (429). */
  get isTransient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
