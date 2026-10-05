import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/exceptions/index.js";
import { PayloadTooLargeError } from "../src/exceptions/index.js";
import { completeTennerSchema, createTennerSchema, MAX_BODY_BYTES, parseJsonBody, updateTennerSchema, validate } from "../src/validators/index.js";

const valid = { title: "Vacuum Office", category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14, assignedTo: "STEFAN" };

function detailsOf(fn: () => unknown): { field: string; message: string }[] {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return [...((error as ValidationError).details ?? [])];
  }
  throw new Error("expected ValidationError");
}

describe("createTennerSchema", () => {
  it("accepts a valid request and trims the title", () => {
    expect(validate(createTennerSchema, { ...valid, title: "  Vacuum Office  " })).toEqual({ ...valid, frequencyUnit: "DAY", frequencyInterval: 14, weekdays: null, assignmentMode: "FIXED", rotation: null });
  });

  it.each([
    ["title too short", { title: "ab" }, "title"],
    ["title too long", { title: "x".repeat(101) }, "title"],
    ["unknown category", { category: "garden" }, "category"],
    ["estimatedMinutes below range", { estimatedMinutes: 0 }, "estimatedMinutes"],
    ["estimatedMinutes above range", { estimatedMinutes: 481 }, "estimatedMinutes"],
    ["estimatedMinutes not integer", { estimatedMinutes: 2.5 }, "estimatedMinutes"],
    ["frequencyDays above range", { frequencyDays: 3651 }, "frequencyDays"],
    ["unknown user", { assignedTo: "bob" }, "assignedTo"],
    ["wrong type", { frequencyDays: "14" }, "frequencyDays"],
  ])("rejects %s", (_name, override, field) => {
    expect(detailsOf(() => validate(createTennerSchema, { ...valid, ...override })).map((d) => d.field)).toContain(field);
  });

  it("accepts boundary values", () => {
    expect(() => validate(createTennerSchema, { ...valid, title: "abc", estimatedMinutes: 480, frequencyDays: 3650 })).not.toThrow();
    expect(() => validate(createTennerSchema, { ...valid, title: "x".repeat(100), estimatedMinutes: 1, frequencyDays: 1 })).not.toThrow();
  });

  it("rejects missing fields and unknown fields", () => {
    expect(detailsOf(() => validate(createTennerSchema, {})).map((d) => d.field)).toEqual(
      expect.arrayContaining(["title", "category", "estimatedMinutes", "assignedTo"]),
    );
    const withoutFrequency = { title: "Vacuum Office", category: "HOUSEHOLD", estimatedMinutes: 10, assignedTo: "STEFAN" };
    expect(detailsOf(() => validate(createTennerSchema, withoutFrequency))).toEqual([{ field: "frequencyDays", message: "frequencyDays or frequencyUnit is required." }]);
    expect(detailsOf(() => validate(createTennerSchema, { ...valid, tenantId: "other" }))).toHaveLength(1);
  });

  it("reports a root-level error for non-object input", () => {
    expect(detailsOf(() => validate(createTennerSchema, null))[0]?.field).toBe("(root)");
  });
});

describe("updateTennerSchema", () => {
  it("accepts a partial update", () => {
    expect(validate(updateTennerSchema, { frequencyDays: 7 })).toEqual({ frequencyDays: 7, frequencyUnit: "DAY", frequencyInterval: 7, weekdays: null });
    expect(validate(updateTennerSchema, { title: "Vacuum" })).toEqual({ title: "Vacuum" });
  });

  it("rejects an empty update", () => {
    expect(detailsOf(() => validate(updateTennerSchema, {}))[0]?.message).toBe("At least one field must be provided.");
  });

  it("still validates provided fields", () => {
    expect(detailsOf(() => validate(updateTennerSchema, { title: "x" }))[0]?.field).toBe("title");
  });
});

describe("completeTennerSchema", () => {
  it("accepts minimal and full requests", () => {
    expect(validate(completeTennerSchema, { completedBy: "JULIA" })).toEqual({ completedBy: "JULIA" });
    expect(
      validate(completeTennerSchema, { completedBy: "STEFAN", actualMinutes: 12, completedAt: "2026-10-01T18:30:00Z" }),
    ).toEqual({ completedBy: "STEFAN", actualMinutes: 12, completedAt: "2026-10-01T18:30:00Z" });
  });

  it.each([
    ["actualMinutes 0", { actualMinutes: 0 }],
    ["actualMinutes 1441", { actualMinutes: 1441 }],
    ["timestamp with offset", { completedAt: "2026-10-01T20:30:00+02:00" }],
    ["date only", { completedAt: "2026-10-01" }],
    ["invalid date", { completedAt: "2026-13-01T10:00:00Z" }],
  ])("rejects %s", (_name, override) => {
    expect(() => validate(completeTennerSchema, { completedBy: "STEFAN", ...override })).toThrow(ValidationError);
  });
});

describe("parseJsonBody", () => {
  it("parses plain and base64 bodies", () => {
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonBody(Buffer.from('{"a":1}').toString("base64"), true)).toEqual({ a: 1 });
  });

  it.each([undefined, "", "{not json"])("rejects %j", (input) => {
    expect(() => parseJsonBody(input)).toThrow(ValidationError);
  });

  it("rejects bodies above the size limit with 413 before parsing (SECURITY-005)", () => {
    const atLimit = JSON.stringify({ a: "x".repeat(MAX_BODY_BYTES - 8) });
    expect(Buffer.byteLength(atLimit)).toBe(MAX_BODY_BYTES);
    expect(parseJsonBody(atLimit)).toEqual({ a: "x".repeat(MAX_BODY_BYTES - 8) });
    const tooLarge = JSON.stringify({ a: "ü".repeat(MAX_BODY_BYTES / 2) });
    expect(() => parseJsonBody(tooLarge)).toThrow(PayloadTooLargeError);
    expect(() => parseJsonBody(Buffer.from(tooLarge).toString("base64"), true)).toThrow(expect.objectContaining({ statusCode: 413, code: "PAYLOAD_TOO_LARGE" }));
  });
});
