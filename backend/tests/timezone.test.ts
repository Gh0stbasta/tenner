import { describe, expect, it } from "vitest";
import { dateInTimeZone, daysBetween, isValidTimeZone } from "../src/utils/timezone.js";

describe("dateInTimeZone", () => {
  it.each([
    ["UTC day differs from Berlin day (summer, UTC+2)", "2026-07-14T22:30:00Z", "2026-07-15"],
    ["UTC day differs from Berlin day (winter, UTC+1)", "2026-01-14T23:30:00Z", "2026-01-15"],
    ["just before Berlin midnight", "2026-07-14T21:59:59Z", "2026-07-14"],
    ["DST start (last Sunday in March)", "2026-03-28T23:30:00Z", "2026-03-29"],
    ["DST end (last Sunday in October)", "2026-10-24T22:30:00Z", "2026-10-25"],
    ["end of month", "2026-04-30T22:30:00Z", "2026-05-01"],
    ["end of year", "2026-12-31T23:30:00Z", "2027-01-01"],
    ["leap day", "2028-02-28T23:30:00Z", "2028-02-29"],
  ])("%s", (_name, instant, expected) => {
    expect(dateInTimeZone(new Date(instant), "Europe/Berlin")).toBe(expected);
  });

  it("uses the requested zone, not the runtime TZ", () => {
    expect(dateInTimeZone(new Date("2026-07-15T02:00:00Z"), "America/New_York")).toBe("2026-07-14");
  });
});

describe("daysBetween", () => {
  it.each([
    ["2026-09-28", "2026-10-01", 3],
    ["2026-10-01", "2026-10-08", 7],
    ["2026-10-01", "2026-09-30", -1],
    ["2026-03-28", "2026-03-30", 2],
    ["2028-02-28", "2028-03-01", 2],
  ])("%s → %s = %i", (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects others", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});
