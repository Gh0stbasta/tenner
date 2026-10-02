import { describe, expect, it } from "vitest";
import { systemClock, toUtcDate, toUtcTimestamp, uuidGenerator } from "../src/utils/clock.js";

describe("clock utilities", () => {
  it("formats UTC timestamps without milliseconds and UTC dates", () => {
    const date = new Date("2026-10-01T18:30:15.999Z");
    expect(toUtcTimestamp(date)).toBe("2026-10-01T18:30:15Z");
    expect(toUtcDate(date)).toBe("2026-10-01");
  });

  it("provides the system clock and UUIDs", () => {
    expect(systemClock()).toBeInstanceOf(Date);
    expect(uuidGenerator()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
