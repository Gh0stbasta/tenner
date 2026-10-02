import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { createQueryClient, MAX_QUERY_RETRIES, shouldRetryQuery } from "./queryClient";

describe("shouldRetryQuery", () => {
  it("retries transient API errors up to the limit", () => {
    const error = new ApiError(503, "HTTP_503", "down");
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, error)).toBe(false);
  });

  it("does not retry client errors", () => {
    expect(shouldRetryQuery(0, new ApiError(404, "NOT_FOUND", "missing"))).toBe(false);
  });

  it("retries unknown errors", () => {
    expect(shouldRetryQuery(1, new Error("boom"))).toBe(true);
  });
});

describe("createQueryClient", () => {
  it("never retries mutations automatically", () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("backs off exponentially up to 8 seconds", () => {
    const retryDelay = createQueryClient().getDefaultOptions().queries?.retryDelay as (attempt: number) => number;
    expect(retryDelay(0)).toBe(1000);
    expect(retryDelay(2)).toBe(4000);
    expect(retryDelay(10)).toBe(8000);
  });
});
