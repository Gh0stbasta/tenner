import { describe, expect, it } from "vitest";
import {
  formatDays,
  formatDaysAgo,
  formatDueIn,
  formatLongDate,
  formatMinutes,
  formatOverdue,
  formatShortDate,
  formatTennerCount,
  parseIsoDate,
} from "./format";

describe("format", () => {
  it("formats counts and durations", () => {
    expect(formatTennerCount(1)).toBe("1 Tenner");
    expect(formatMinutes(10)).toBe("10 Min.");
    expect(formatDays(1)).toBe("1 Tag");
    expect(formatDays(14)).toBe("14 Tage");
    expect(formatDays(14.5)).toBe("14,5 Tage");
    expect(formatDaysAgo(0)).toBe("heute");
    expect(formatDaysAgo(1)).toBe("gestern");
    expect(formatDaysAgo(13)).toBe("vor 13 Tagen");
  });

  it("formats overdue and due-in phrases", () => {
    expect(formatOverdue(1)).toBe("seit 1 Tag überfällig");
    expect(formatOverdue(12)).toBe("seit 12 Tagen überfällig");
    expect(formatDueIn(0)).toBe("heute fällig");
    expect(formatDueIn(1)).toBe("morgen fällig");
    expect(formatDueIn(3)).toBe("fällig in 3 Tagen");
  });

  it("parses calendar dates without timezone shift", () => {
    const date = parseIsoDate("2026-10-02");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 2]);
  });

  it("formats dates in German", () => {
    expect(formatShortDate("2026-10-02")).toBe("Fr., 2. Okt.");
    expect(formatLongDate("2026-10-02")).toBe("Freitag, 2. Oktober");
  });
});
