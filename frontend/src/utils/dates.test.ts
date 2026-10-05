import { describe, expect, it } from "vitest";
import { daysBetween, todayIsoDate } from "./dates";

describe("dates", () => {
  it("formats today as a local calendar date", () => {
    expect(todayIsoDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("uses the household timezone when given (SCHEDULING-008)", () => {
    // 1 Oct 22:30 UTC = 2 Oct 00:30 in Berlin, still 1 Oct in New York
    const instant = new Date("2026-10-01T22:30:00Z");
    expect(todayIsoDate(instant, "Europe/Berlin")).toBe("2026-10-02");
    expect(todayIsoDate(instant, "America/New_York")).toBe("2026-10-01");
    expect(todayIsoDate(instant, "UTC")).toBe("2026-10-01");
  });

  it("counts whole days across DST changes", () => {
    expect(daysBetween("2026-10-20", "2026-10-30")).toBe(10);
    expect(daysBetween("2026-10-30", "2026-10-20")).toBe(-10);
    expect(daysBetween("2026-10-02", "2026-10-02")).toBe(0);
  });
});
