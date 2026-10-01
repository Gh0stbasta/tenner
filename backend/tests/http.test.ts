import { describe, expect, it } from "vitest";
import { ConflictError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { errorResponse, jsonResponse, successResponse } from "../src/utils/http.js";

const parse = (r: { body?: string | undefined }): unknown => JSON.parse(r.body ?? "");

describe("http helpers", () => {
  it("wraps data in the success envelope", () => {
    const response = successResponse(201, { tennerId: "t1" });
    expect(response.statusCode).toBe(201);
    expect(parse(response)).toEqual({ success: true, data: { tennerId: "t1" } });
    expect(response.headers?.["content-type"]).toBe("application/json");
  });

  it("merges extra headers", () => {
    expect(jsonResponse(200, {}, { etag: "x" }).headers).toMatchObject({ etag: "x", "cache-control": "no-store" });
  });

  it("includes validation details for client errors", () => {
    const response = errorResponse(new ValidationError("Validation failed.", [{ field: "title", message: "Required" }]));
    expect(response.statusCode).toBe(400);
    expect(parse(response)).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validation failed.", details: [{ field: "title", message: "Required" }] },
    });
  });

  it("omits empty details", () => {
    expect(parse(errorResponse(new ConflictError("Conflict.")))).toEqual({ success: false, error: { code: "CONFLICT", message: "Conflict." } });
  });

  it("returns generic bodies for server errors", () => {
    expect(parse(errorResponse(new PersistenceError("A storage error occurred.", { cause: new Error("x") })))).toEqual({
      success: false,
      error: { code: "PERSISTENCE_ERROR", message: "A storage error occurred." },
    });
    expect(errorResponse("boom").statusCode).toBe(500);
  });
});
