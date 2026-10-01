import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/exceptions/index.js";
import { decodeCursor, encodeCursor } from "../src/utils/cursor.js";

const key = { tenantId: "default", historyId: "c-1", completedAt: "2026-10-01T18:30:00Z" };

describe("cursor", () => {
  it("round-trips an opaque base64url cursor", () => {
    const cursor = encodeCursor("default", key);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor, "default")).toEqual(key);
  });

  it.each([
    ["a cursor of another tenant", encodeCursor("other", { ...key, tenantId: "other" })],
    ["a key whose tenantId differs from the envelope", encodeCursor("default", { ...key, tenantId: "other" })],
    ["garbage", "not-json"],
    ["a non-object key", Buffer.from(JSON.stringify({ t: "default", k: "x" })).toString("base64url")],
    ["an array key", Buffer.from(JSON.stringify({ t: "default", k: ["x"] })).toString("base64url")],
    ["an empty key", Buffer.from(JSON.stringify({ t: "default", k: {} })).toString("base64url")],
    ["non-string key values", Buffer.from(JSON.stringify({ t: "default", k: { tenantId: "default", n: 1 } })).toString("base64url")],
    ["JSON null", Buffer.from("null").toString("base64url")],
  ])("rejects %s", (_name, cursor) => {
    expect(() => decodeCursor(cursor, "default")).toThrow(ValidationError);
  });
});
