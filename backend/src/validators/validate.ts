/** Central validation entry point: turns schema failures into a ValidationError. */

import type { z } from "zod";
import { PayloadTooLargeError, ValidationError, type ErrorDetail } from "../exceptions/index.js";

/** Validate untrusted input against a schema. Returns typed data or throws ValidationError. */
export function validate<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new ValidationError("Validation failed.", toDetails(result.error));
}

function toDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

/**
 * Largest accepted request body (SECURITY-005). The biggest real request (a Tenner with a 120-character title)
 * is far below 1 KiB; API Gateway itself allows 10 MB.
 */
export const MAX_BODY_BYTES = 16 * 1024;

/** Parse a JSON request body. Missing, oversized or malformed bodies are rejected before parsing. */
export function parseJsonBody(body: string | undefined, isBase64Encoded = false): unknown {
  if (body === undefined || body === "") throw new ValidationError("Request body is required.");
  const text = isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new PayloadTooLargeError(`Request body must not exceed ${MAX_BODY_BYTES} bytes.`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}
