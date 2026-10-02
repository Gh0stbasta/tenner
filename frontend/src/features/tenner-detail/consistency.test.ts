import { describe, expect, it } from "vitest";
import type { HistoryItem } from "../completions/api";
import { computeConsistency } from "./consistency";

const NOW = new Date("2026-10-02T12:00:00Z");
const item = (completedAt: string, revertedAt: string | null = null): HistoryItem => ({
  completionId: completedAt,
  tennerId: "t-1",
  tennerTitle: "x",
  completedBy: "STEFAN",
  completedAt,
  actualMinutes: 10,
  revertedAt,
});

describe("computeConsistency", () => {
  it("counts completions in the last 90 days and averages intervals", () => {
    const items = [
      item("2026-10-01T10:00:00Z"),
      item("2026-09-17T10:00:00Z"),
      item("2026-09-03T10:00:00Z"),
      item("2026-05-01T10:00:00Z"),
    ];
    const result = computeConsistency(items, NOW);
    expect(result.recentCount).toBe(3);
    expect(result.averageIntervalDays).toBe(51); // 1 May → 1 Oct = 153 days over 3 intervals
  });

  it("averages regular completions exactly", () => {
    const items = [item("2026-09-30T10:00:00Z"), item("2026-09-16T10:00:00Z"), item("2026-09-02T10:00:00Z")];
    expect(computeConsistency(items, NOW)).toEqual({ recentCount: 3, averageIntervalDays: 14 });
  });

  it("ignores reverted completions and needs two for an average", () => {
    const items = [item("2026-09-30T10:00:00Z"), item("2026-09-20T10:00:00Z", "2026-09-20T10:05:00Z")];
    expect(computeConsistency(items, NOW)).toEqual({ recentCount: 1, averageIntervalDays: undefined });
    expect(computeConsistency([], NOW)).toEqual({ recentCount: 0, averageIntervalDays: undefined });
  });
});
