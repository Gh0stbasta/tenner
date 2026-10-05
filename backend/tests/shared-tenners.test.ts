/** HOUSEHOLD-002: shared (unassigned) Tenners. */

import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "../src/exceptions/index.js";
import { SEED_MEMBERS, SHARED_ASSIGNEE, type HouseholdMember } from "../src/models/index.js";
import { CompleteTennerService, CreateTennerService, DashboardService, ListTennersService, MemberDeactivationService, MemberService, UpdateTennerService } from "../src/services/index.js";
import { householdSettings, mockCompletionRepository, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-05T08:00:00Z");
const request = { title: "Spülmaschine ausräumen", category: "HOUSEHOLD", estimatedMinutes: 5, frequencyDays: 1, frequencyUnit: "DAY", frequencyInterval: 1, weekdays: null, assignmentMode: "FIXED", rotation: null } as const;

describe("shared Tenners", () => {
  it("can be created and changed with the reserved assignee", async () => {
    const created = await new CreateTennerService(mockTennerRepository(), () => NOW, () => "t-1", async () => "UTC").createTenner(TEST_IDENTITY, { ...request, assignedTo: SHARED_ASSIGNEE });
    expect(created.assignedTo).toBe("HOUSEHOLD");
    const repo = mockTennerRepository();
    repo.update.mockResolvedValue(tennerFixture({ assignedTo: SHARED_ASSIGNEE }));
    await expect(new UpdateTennerService(repo, () => NOW).updateTenner(TEST_IDENTITY, "t-1", { assignedTo: SHARED_ASSIGNEE })).resolves.toMatchObject({ assignedTo: "HOUSEHOLD" });
  });

  it("can be completed by any member but HOUSEHOLD is no completer", async () => {
    const repo = mockTennerRepository();
    repo.getById.mockResolvedValue(tennerFixture({ assignedTo: SHARED_ASSIGNEE }));
    repo.completeTenner.mockResolvedValue(undefined);
    const service = new CompleteTennerService(repo, mockCompletionRepository(), () => NOW, () => "c-1", async () => "UTC");
    await expect(service.completeTenner({ tenantId: "default", userId: "JULIA" }, "t-1", {})).resolves.toMatchObject({ response: { completion: { completedBy: "JULIA" } } });
    await expect(service.completeTenner(TEST_IDENTITY, "t-1", { completedBy: SHARED_ASSIGNEE })).rejects.toBeInstanceOf(ValidationError);
  });

  it("is reserved: no member can get the ID HOUSEHOLD", async () => {
    const households = { get: vi.fn(async () => undefined), saveMembers: vi.fn() };
    const service = new MemberService(households, () => NOW);
    await expect(service.createMember(TEST_IDENTITY, { displayName: "Household", color: "BLUE" })).rejects.toMatchObject({ details: [{ field: "userId" }] });
    await expect(service.createMember(TEST_IDENTITY, { userId: "HOUSEHOLD", displayName: "Haus", color: "BLUE" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("can receive the Tenners of a deactivated member", async () => {
    const lena: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true, createdAt: "t", updatedAt: "t" };
    const households = { get: vi.fn(async () => householdSettings({ members: [...SEED_MEMBERS, lena], membersVersion: 1 })), saveMembers: vi.fn(async () => householdSettings()) };
    const tenners = mockTennerRepository();
    tenners.list.mockResolvedValue([tennerFixture({ tennerId: "a", assignedTo: "LENA" })]);
    tenners.update.mockResolvedValue(tennerFixture());
    const result = await new MemberDeactivationService(households, tenners, async () => 0, () => NOW).deactivate(TEST_IDENTITY, "LENA", { reassignTo: SHARED_ASSIGNEE });
    expect(result).toMatchObject({ reassigned: 1, reassignedTo: "HOUSEHOLD" });
  });
});

describe("dashboard and lists with shared Tenners", () => {
  const tenners = [
    tennerFixture({ tennerId: "own", assignedTo: "STEFAN", nextDue: "2026-10-05", estimatedMinutes: 10 }),
    tennerFixture({ tennerId: "julia", assignedTo: "JULIA", nextDue: "2026-10-05", estimatedMinutes: 20 }),
    tennerFixture({ tennerId: "shared", assignedTo: SHARED_ASSIGNEE, nextDue: "2026-10-04", estimatedMinutes: 15 }),
  ];
  function dashboard(request: { assignedTo?: string } = {}) {
    const repo = mockTennerRepository();
    repo.getDashboardCandidates.mockResolvedValue(tenners);
    repo.list.mockResolvedValue([]);
    return new DashboardService(repo, () => NOW, async () => "UTC", async () => null, async () => SEED_MEMBERS).getDashboard("default", request);
  }

  it("includes shared Tenners in a member filter", async () => {
    const result = await dashboard({ assignedTo: "STEFAN" });
    expect([...result.dueToday, ...result.overdue].map((t) => t.tennerId)).toEqual(["own", "shared"]);
    const onlyShared = await dashboard({ assignedTo: SHARED_ASSIGNEE });
    expect(onlyShared.overdue.map((t) => t.tennerId)).toEqual(["shared"]);
  });

  it("splits shared load evenly across active members", async () => {
    const result = await dashboard();
    expect(result.byUser).toEqual({
      STEFAN: { count: 2, estimatedMinutes: 18, sharedCount: 1 },
      JULIA: { count: 2, estimatedMinutes: 28, sharedCount: 1 },
    });
  });

  it("queries the assignedTo index for the member and for shared Tenners", async () => {
    const repo = mockTennerRepository();
    repo.list.mockImplementation(async (_tenant, criteria) => tenners.filter((t) => t.assignedTo === criteria?.assignedTo));
    const service = new ListTennersService(repo, () => NOW, async () => "UTC");
    const result = await service.listTenners("default", { assignedTo: "STEFAN" });
    expect(repo.list.mock.calls.map(([, criteria]) => criteria?.assignedTo)).toEqual(["STEFAN", "HOUSEHOLD"]);
    expect(result.map((t) => t.tennerId)).toEqual(["shared", "own"]);
    repo.list.mockClear();
    await service.listTenners("default", { assignedTo: SHARED_ASSIGNEE });
    expect(repo.list).toHaveBeenCalledOnce();
  });
});
