import { describe, expect, it } from "vitest";
import { addDays } from "../src/utils/clock.js";
import { sha256Json, uuidV5 } from "../src/utils/uuid.js";

describe("uuidV5", () => {
  it("matches the RFC example (DNS namespace, www.example.com)", () => {
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("is deterministic per name and differs between names", () => {
    expect(uuidV5("default:key-1")).toBe(uuidV5("default:key-1"));
    expect(uuidV5("default:key-1")).not.toBe(uuidV5("default:key-2"));
    expect(uuidV5("default:key-1")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("sha256Json", () => {
  it("hashes JSON values", () => {
    expect(sha256Json({ a: 1 })).toBe(sha256Json({ a: 1 }));
    expect(sha256Json({ a: 1 })).not.toBe(sha256Json({ a: 2 }));
  });
});

describe("addDays", () => {
  it.each([
    ["2026-10-01", 14, "2026-10-15"],
    ["2026-12-25", 7, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-03-28", 1, "2026-03-29"],
    ["2026-10-24", 2, "2026-10-26"],
    ["2026-01-01", 3650, "2035-12-30"],
  ])("%s + %i days = %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});
