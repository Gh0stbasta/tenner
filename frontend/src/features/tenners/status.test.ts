import { describe, expect, it } from "vitest";
import { tenner } from "../../tests/fixtures";
import { tennerStatus } from "./status";

const TODAY = "2026-10-10";

describe("tennerStatus", () => {
  it.each([
    [{ deletedAt: "2026-10-01T00:00:00Z" }, "archived", "Archiviert"],
    [{ active: false }, "inactive", "Inaktiv"],
    [{ nextDue: "2026-10-01" }, "overdue", "seit 9 Tagen überfällig"],
    [{ nextDue: TODAY }, "dueToday", "Heute fällig"],
    [{ nextDue: "2026-10-11" }, "upcoming", "morgen fällig"],
    [{ nextDue: "2026-10-24" }, "upcoming", "fällig in 14 Tagen"],
  ])("maps %j to %s", (overrides, kind, label) => {
    expect(tennerStatus(tenner(overrides), TODAY)).toEqual({ kind, label });
  });
});
