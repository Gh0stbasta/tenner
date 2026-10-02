import { describe, expect, it } from "vitest";
import {
  ApplicationError,
  ConflictError,
  NotFoundError,
  PersistenceError,
  UnauthorizedError,
  ValidationError,
} from "../src/exceptions/index.js";

describe("application errors", () => {
  it.each([
    [new ValidationError(), "VALIDATION_ERROR", 400, "ValidationError"],
    [new UnauthorizedError(), "UNAUTHORIZED", 401, "UnauthorizedError"],
    [new NotFoundError(), "NOT_FOUND", 404, "NotFoundError"],
    [new ConflictError(), "CONFLICT", 409, "ConflictError"],
    [new ConflictError("Modified.", "CONCURRENT_MODIFICATION"), "CONCURRENT_MODIFICATION", 409, "ConflictError"],
    [new PersistenceError(), "PERSISTENCE_ERROR", 500, "PersistenceError"],
  ])("%s has code %s and status %i", (error, code, status, name) => {
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(code);
    expect(error.statusCode).toBe(status);
    expect(error.name).toBe(name);
  });

  it("keeps validation details and persistence causes", () => {
    expect(new ValidationError("Bad.", [{ field: "title", message: "Required" }]).details).toEqual([{ field: "title", message: "Required" }]);
    const cause = new Error("ddb");
    expect(new PersistenceError("Failed.", { cause }).cause).toBe(cause);
    expect(new PersistenceError().cause).toBeUndefined();
  });
});
