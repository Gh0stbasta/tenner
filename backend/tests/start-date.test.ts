/** HOTFIX-006: a Tenner can start in the future; before its start date it is not due, not shown, not reminded. */

import { describe, expect, it } from "vitest";
import { toTennerResponse } from "../src/dto/index.js";
import { startDateOf } from "../src/models/index.js";
import { toTenner } from "../src/repositories/dynamodb/tenner.mapper.js";
import { CreateTennerService, DashboardService, UpdateTennerService } from "../src/services/index.js";
import { createTennerSchema, updateTennerSchema } from "../src/validators/index.js";
import { mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

// Monday, 5 Oct 2026, 10:00 in Berlin.
const NOW = new Date("2026-10-05T08:00:00Z");
const TODAY = "2026-10-05";
const REQUEST = { title: "Fenster putzen", category: "HOUSEHOLD", estimatedMinutes: 30, frequencyDays: 28, frequencyUnit: "WEEK", frequencyInterval: 4, weekdays: null, assignedTo: "STEFAN", assignmentMode: "FIXED", rotation: null } as const;

function create(startDate?: string) {
  const repository = mockTennerRepository();
  const service = new CreateTennerService(repository, () => NOW, () => "t-1", async () => "Europe/Berlin");
  return { repository, created: service.createTenner(TEST_IDENTITY, { ...REQUEST, ...(startDate ? { startDate } : {}) }) };
}

describe("start date (HOTFIX-006)", () => {
  it("is due on its start date at the earliest; default and past start dates mean today", async () => {
    expect(await create("2026-11-01").created).toMatchObject({ startDate: "2026-11-01", nextDue: "2026-11-01" });
    expect(await create().created).toMatchObject({ startDate: TODAY, nextDue: TODAY });
    expect(await create("2026-09-01").created).toMatchObject({ startDate: "2026-09-01", nextDue: TODAY });
    const { repository, created } = create("2026-11-01");
    await created;
    expect(repository.save.mock.calls[0]?.[0]).toMatchObject({ startDate: "2026-11-01", nextDue: "2026-11-01" });
  });

  it("moves the next due date with a start date from today on; a past one is only stored", async () => {
    const repository = mockTennerRepository();
    repository.update.mockResolvedValue(tennerFixture());
    const service = new UpdateTennerService(repository, () => NOW, undefined, undefined, async () => "Europe/Berlin");
    await service.updateTenner(TEST_IDENTITY, "t-1", { startDate: "2026-12-01" });
    expect(repository.update.mock.calls[0]?.[2]).toMatchObject({ startDate: "2026-12-01", nextDue: "2026-12-01" });
    await service.updateTenner(TEST_IDENTITY, "t-1", { startDate: "2026-01-01" });
    expect(repository.update.mock.calls[1]?.[2]).toMatchObject({ startDate: "2026-01-01" });
    expect(repository.update.mock.calls[1]?.[2]).not.toHaveProperty("nextDue");
    await service.updateTenner(TEST_IDENTITY, "t-1", { title: "Neu" });
    expect(repository.update.mock.calls[2]?.[2]).not.toHaveProperty("startDate");
  });

  it("keeps Tenners out of the dashboard before their start date", async () => {
    const repository = mockTennerRepository();
    const later = tennerFixture({ tennerId: "later", nextDue: "2026-10-08", startDate: "2026-10-08" });
    const now = tennerFixture({ tennerId: "now", nextDue: "2026-10-08", startDate: "2026-10-01" });
    repository.getDashboardCandidates.mockResolvedValue([later, now]);
    repository.list.mockResolvedValue([]);
    const dashboard = await new DashboardService(repository, () => NOW, async () => "Europe/Berlin", async () => null).getDashboard("default");
    expect(dashboard.upcoming.map((tenner) => tenner.tennerId)).toEqual(["now"]);
  });

  it("gives Tenners created before HOTFIX-006 their creation date as start date", () => {
    const old = tennerFixture({ createdAt: "2026-09-01T10:00:00Z" });
    expect(startDateOf(old)).toBe("2026-09-01");
    expect(toTennerResponse(old).startDate).toBe("2026-09-01");
    expect(toTenner({ ...old, startDate: "2026-12-24" }).startDate).toBe("2026-12-24");
    expect(toTenner({ ...old })).not.toHaveProperty("startDate");
  });

  it("accepts a calendar date in create and update requests", () => {
    expect(createTennerSchema.parse({ title: "Fenster putzen", category: "HOUSEHOLD", estimatedMinutes: 30, frequencyUnit: "WEEK", frequencyInterval: 4, assignedTo: "STEFAN", startDate: "2026-11-01" }).startDate).toBe("2026-11-01");
    expect(updateTennerSchema.parse({ startDate: "2026-11-01" })).toEqual({ startDate: "2026-11-01" });
    expect(() => updateTennerSchema.parse({ startDate: "2026-13-01" })).toThrow();
  });
});
