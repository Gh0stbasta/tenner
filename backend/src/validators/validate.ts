/** Central validation entry point: turns schema failures into a ValidationError. */

import type { z } from "zod";
import { ValidationError, type ErrorDetail } from "../exceptions/index.js";

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

/** Parse a JSON request body. Missing or malformed bodies raise ValidationError. */
export function parseJsonBody(body: string | undefined, isBase64Encoded = false): unknown {
  if (body === undefined || body === "") throw new ValidationError("Request body is required.");
  try {
    const text = isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}
