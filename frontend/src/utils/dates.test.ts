import { describe, expect, it } from "vitest";
import { daysBetween, todayIsoDate } from "./dates";

describe("dates", () => {
  it("formats today as a local calendar date", () => {
    expect(todayIsoDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("counts whole days across DST changes", () => {
    expect(daysBetween("2026-10-20", "2026-10-30")).toBe(10);
    expect(daysBetween("2026-10-30", "2026-10-20")).toBe(-10);
    expect(daysBetween("2026-10-02", "2026-10-02")).toBe(0);
  });
});
