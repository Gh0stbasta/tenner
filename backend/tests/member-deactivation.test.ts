/** HOUSEHOLD-ADMIN-004: member deactivation and reactivation. */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, ValidationError } from "../src/exceptions/index.js";
import { deactivateMemberHandler, reactivateMemberHandler } from "../src/handlers/members.js";
import { SEED_MEMBERS, type HouseholdMember } from "../src/models/index.js";
import { CognitoHouseholdMembershipRepository } from "../src/repositories/index.js";
import { CompleteTennerService, CreateTennerService, HistoryService, MemberDeactivationService } from "../src/services/index.js";
import { householdSettings, mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-05T08:00:00Z");
const TS = "2026-10-05T08:00:00Z";
const LENA: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true, canSignIn: true, createdAt: TS, updatedAt: TS };

function setup(members: readonly HouseholdMember[] = [...SEED_MEMBERS, LENA], assigned = [tennerFixture({ tennerId: "a", assignedTo: "LENA" }), tennerFixture({ tennerId: "b", assignedTo: "LENA", active: false })]) {
  const households = {
    get: vi.fn(async () => householdSettings({ members, membersVersion: 4 })),
    saveMembers: vi.fn<(tenantId: string, saved: readonly HouseholdMember[], version: number) => Promise<ReturnType<typeof householdSettings>>>(async (_t, saved) =>
      householdSettings({ members: saved, membersVersion: 5 }),
    ),
  };
  const tenners = mockTennerRepository();
  tenners.list.mockResolvedValue(assigned);
  tenners.update.mockImplementation(async (_t, id) => tennerFixture({ tennerId: id }));
  const revokeAccess = vi.fn(async () => 1);
  return { households, tenners, revokeAccess, service: new MemberDeactivationService(households, tenners, revokeAccess, () => NOW) };
}

describe("MemberDeactivationService", () => {
  it("deactivates with reassignment, keeps the member and revokes access", async () => {
    const { households, tenners, revokeAccess, service } = setup();
    const result = await service.deactivate(TEST_IDENTITY, "LENA", { reassignTo: "JULIA" });
    expect(tenners.list).toHaveBeenCalledWith("default", { assignedTo: "LENA" });
    expect(tenners.update.mock.calls.map(([, id, changes]) => [id, changes])).toEqual([
      ["a", { assignedTo: "JULIA", updatedAt: TS, updatedBy: "STEFAN" }],
      ["b", { assignedTo: "JULIA", updatedAt: TS, updatedBy: "STEFAN" }],
    ]);
    expect(households.saveMembers.mock.calls[0]?.[1].find((m) => m.userId === "LENA")).toMatchObject({ active: false, displayName: "Lena", updatedAt: TS });
    expect(households.saveMembers.mock.calls[0]?.[2]).toBe(4);
    expect(revokeAccess).toHaveBeenCalledWith("default", "LENA");
    expect(result).toEqual({ member: { userId: "LENA", displayName: "Lena", color: "GREEN", active: false, canSignIn: true }, reassigned: 2, reassignedTo: "JULIA", revokedAccounts: 1 });
  });

  it("needs no reassignment for members without Tenners", async () => {
    const { tenners, service } = setup(undefined, []);
    await expect(service.deactivate(TEST_IDENTITY, "LENA", {})).resolves.toMatchObject({ reassigned: 0, reassignedTo: null });
    expect(tenners.update).not.toHaveBeenCalled();
  });

  it("requires a valid reassignment target when Tenners exist", async () => {
    const { tenners, households, service } = setup();
    const fields = async (request: { reassignTo?: string }) => {
      try {
        await service.deactivate(TEST_IDENTITY, "LENA", request);
      } catch (error) {
        return (error as ValidationError).details;
      }
      return undefined;
    };
    expect(await fields({})).toEqual([{ field: "reassignTo", message: "Required: 2 Tenner(s) are assigned to LENA." }]);
    expect(await fields({ reassignTo: "LENA" })).toEqual([{ field: "reassignTo", message: "Must be another active household member or HOUSEHOLD (shared)." }]);
    expect(await fields({ reassignTo: "BOB" })).toHaveLength(1);
    expect(tenners.update).not.toHaveBeenCalled();
    expect(households.saveMembers).not.toHaveBeenCalled();
  });

  it("protects the last active member, yourself and already deactivated members", async () => {
    const onlyStefan = setup([SEED_MEMBERS[0] as HouseholdMember, { ...LENA, active: false }]);
    await expect(onlyStefan.service.deactivate({ tenantId: "default", userId: "JULIA" }, "STEFAN", {})).rejects.toMatchObject({ code: "LAST_ACTIVE_MEMBER" });
    const { service } = setup([...SEED_MEMBERS, { ...LENA, active: false }]);
    await expect(service.deactivate(TEST_IDENTITY, "STEFAN", {})).rejects.toMatchObject({ code: "CANNOT_DEACTIVATE_SELF", statusCode: 409 });
    await expect(service.deactivate(TEST_IDENTITY, "LENA", {})).rejects.toMatchObject({ code: "MEMBER_INACTIVE" });
    await expect(service.deactivate(TEST_IDENTITY, "NOBODY", {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("reactivates a deactivated member", async () => {
    const { households, service } = setup([...SEED_MEMBERS, { ...LENA, active: false }]);
    await expect(service.reactivate(TEST_IDENTITY, "LENA")).resolves.toEqual({ userId: "LENA", displayName: "Lena", color: "GREEN", active: true, canSignIn: true });
    expect(households.saveMembers.mock.calls[0]?.[1].find((m) => m.userId === "LENA")?.active).toBe(true);
    await expect(setup().service.reactivate(TEST_IDENTITY, "LENA")).rejects.toBeInstanceOf(ConflictError);
    await expect(setup().service.reactivate(TEST_IDENTITY, "NOBODY")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("deactivated members in validation and history", () => {
  const members = async () => [...SEED_MEMBERS, { ...LENA, active: false }];

  it("rejects deactivated members as assignee and as completedBy", async () => {
    const create = new CreateTennerService(mockTennerRepository(), () => NOW, () => "t-1", async () => "UTC", members);
    const request = { title: "Spielen", category: "FAMILY", estimatedMinutes: 10, frequencyDays: 1, frequencyUnit: "DAY", frequencyInterval: 1, weekdays: null, assignmentMode: "FIXED", rotation: null } as const;
    await expect(create.createTenner(TEST_IDENTITY, { ...request, assignedTo: "LENA" })).rejects.toBeInstanceOf(ValidationError);
    const repo = mockTennerRepository();
    repo.getById.mockResolvedValue(tennerFixture());
    const complete = new CompleteTennerService(repo, mockCompletionRepository(), () => NOW, () => "c-1", async () => "UTC", async () => null, members);
    await expect(complete.completeTenner(TEST_IDENTITY, "t-1", { completedBy: "LENA" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("keeps completions of deactivated members in the history unchanged", async () => {
    const completions = mockCompletionRepository();
    completions.getHistory.mockResolvedValue({ items: [{ tenantId: "default", completionId: "c-1", tennerId: "t-1", completedBy: "LENA", recordedBy: "LENA", completedAt: TS, actualMinutes: 5, revertedAt: null, revertedBy: null, revertReason: null }] });
    const tenners = mockTennerRepository();
    tenners.getTitles.mockResolvedValue(new Map([["t-1", "Spielen"]]));
    const history = await new HistoryService(completions, tenners).getHistory("default", {});
    expect(history.items[0]).toMatchObject({ completedBy: "LENA", tennerTitle: "Spielen" });
  });
});

describe("CognitoHouseholdMembershipRepository.removeAllMembers", () => {
  it("removes every account across pages and treats a missing group as empty", async () => {
    const send = vi.fn(async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (command.constructor.name === "ListUsersInGroupCommand") {
        return command.input.NextToken ? { Users: [{ Username: "google_2" }] } : { Users: [{ Username: "google_1" }, {}], NextToken: "page-2" };
      }
      return {};
    });
    const repo = new CognitoHouseholdMembershipRepository({ send } as never, "pool-1");
    await expect(repo.removeAllMembers("household:default:LENA")).resolves.toBe(2);
    const removed = send.mock.calls.filter(([c]) => c.constructor.name === "AdminRemoveUserFromGroupCommand").map(([c]) => c.input.Username);
    expect(removed).toEqual(["google_1", "google_2"]);
    const missing = new CognitoHouseholdMembershipRepository({ send: vi.fn(async () => Promise.reject(Object.assign(new Error("x"), { name: "ResourceNotFoundException" }))) } as never, "p");
    await expect(missing.removeAllMembers("g")).resolves.toBe(0);
    const failing = new CognitoHouseholdMembershipRepository({ send: vi.fn(async () => Promise.reject(new Error("AccessDenied"))) } as never, "p");
    await expect(failing.removeAllMembers("g")).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("deactivation handlers", () => {
  const event = (body: string | undefined, userId = "LENA") => ({ body, isBase64Encoded: false, pathParameters: { userId } }) as unknown as APIGatewayProxyEventV2;
  const result = { member: { userId: "LENA", displayName: "Lena", color: "GREEN" as const, active: false, canSignIn: true }, reassigned: 2, reassignedTo: "JULIA", revokedAccounts: 1 };

  it("deactivates with logging and accepts an empty body", async () => {
    const logger = mockLogger();
    const deactivate = vi.fn(async () => result);
    await deactivateMemberHandler(event(JSON.stringify({ reassignTo: "JULIA" })), TEST_IDENTITY, deactivate, logger);
    expect(deactivate).toHaveBeenCalledWith(TEST_IDENTITY, "LENA", { reassignTo: "JULIA" });
    expect(logger.info).toHaveBeenCalledWith("Household member deactivated", { event: "MemberDeactivated", userId: "LENA", deactivatedBy: "STEFAN", reassigned: 2, reassignedTo: "JULIA", revokedAccounts: 1 });
    await deactivateMemberHandler(event(undefined), TEST_IDENTITY, deactivate, logger);
    expect(deactivate).toHaveBeenLastCalledWith(TEST_IDENTITY, "LENA", {});
    await expect(deactivateMemberHandler(event(JSON.stringify({ reassignTo: "julia" })), TEST_IDENTITY, deactivate, logger)).rejects.toBeInstanceOf(ValidationError);
  });

  it("reactivates with logging", async () => {
    const logger = mockLogger();
    const response = await reactivateMemberHandler(event(undefined), TEST_IDENTITY, vi.fn(async () => result.member), logger);
    expect(response.statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith("Household member reactivated", { event: "MemberReactivated", userId: "LENA", reactivatedBy: "STEFAN" });
  });
});
