import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format";

const NOW = new Date(2026, 9, 2, 18, 0, 0);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("formatRelativeTime", () => {
  it.each([
    [ago(30_000), "gerade eben"],
    [ago(60_000), "vor 1 Minute"],
    [ago(15 * 60_000), "vor 15 Minuten"],
    [ago(60 * 60_000), "vor 1 Stunde"],
    [ago(3 * 60 * 60_000), "vor 3 Stunden"],
    [new Date(2026, 9, 1, 22, 0).toISOString(), "gestern"],
    [new Date(2026, 8, 28, 9, 0).toISOString(), "vor 4 Tagen"],
    [new Date(2026, 8, 1, 9, 0).toISOString(), "1. Sept."],
  ])("%s → %s", (timestamp, expected) => {
    expect(formatRelativeTime(timestamp, NOW)).toBe(expected);
  });
});
