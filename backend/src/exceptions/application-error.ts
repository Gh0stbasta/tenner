/**
 * Application error hierarchy. Every expected failure is an ApplicationError with a stable
 * machine-readable code and an HTTP status. Messages are safe to return to clients.
 */

export interface ErrorDetail {
  readonly field: string;
  readonly message: string;
}

export class ApplicationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: readonly ErrorDetail[] | undefined;

  constructor(code: string, statusCode: number, message: string, details?: readonly ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = "Validation failed.", details?: readonly ErrorDetail[]) {
    super("VALIDATION_ERROR", 400, message, details);
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = "Unauthorized.") {
    super("UNAUTHORIZED", 401, message);
  }
}

/** 403: authenticated, but the identity may not perform the request (SECURITY-004). */
export class ForbiddenError extends ApplicationError {
  constructor(message = "Forbidden.") {
    super("FORBIDDEN", 403, message);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = "Resource not found.") {
    super("NOT_FOUND", 404, message);
  }
}

/** 413: request body above the accepted size (SECURITY-005). */
export class PayloadTooLargeError extends ApplicationError {
  constructor(message = "Request body is too large.") {
    super("PAYLOAD_TOO_LARGE", 413, message);
  }
}

/** 409 Conflict. The code can be specialized, e.g. TENNER_INACTIVE or CONCURRENT_MODIFICATION. */
export class ConflictError extends ApplicationError {
  constructor(message = "Conflict.", code = "CONFLICT") {
    super(code, 409, message);
  }
}

/** Storage failure. The client sees a generic message; the cause is kept for logging only. */
export class PersistenceError extends ApplicationError {
  constructor(message = "A storage error occurred.", options?: { cause?: unknown }) {
    super("PERSISTENCE_ERROR", 500, message);
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}
