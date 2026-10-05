/** HOUSEHOLD-ADMIN-001: household member management. */

import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { identityFromEvent } from "../src/auth/index.js";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { createMemberHandler, listMembersHandler, updateMemberHandler } from "../src/handlers/members.js";
import { SEED_MEMBERS, type HouseholdMember, type HouseholdSettings } from "../src/models/index.js";
import { DynamoDbHouseholdRepository } from "../src/repositories/index.js";
import { CompleteTennerService, CreateTennerService, HouseholdAssignmentService, MemberService, slugify, UpdateTennerService } from "../src/services/index.js";
import { householdSettings, mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-05T08:00:00Z");
const TS = "2026-10-05T08:00:00Z";
const LENA: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true, createdAt: TS, updatedAt: TS };

function repository(stored?: Partial<HouseholdSettings>) {
  const settings: HouseholdSettings | undefined = stored
    ? householdSettings(stored)
    : undefined;
  return {
    get: vi.fn(async () => settings),
    saveMembers: vi.fn(async (tenantId: string, members: readonly HouseholdMember[], version: number) => ({
      ...(settings ?? householdSettings({ tenantId, updatedAt: TS })),
      members,
      membersVersion: version + 1,
    })),
  };
}

describe("MemberService", () => {
  it("lists the seed members until the household saves its own list", async () => {
    const service = new MemberService(repository(), () => NOW);
    await expect(service.listMembers("default")).resolves.toEqual([
      { userId: "STEFAN", displayName: "Stefan", color: "BLUE", active: true },
      { userId: "JULIA", displayName: "Julia", color: "PURPLE", active: true },
    ]);
  });

  it("creates a member with a slug ID and stores the seed plus the new member (seed is idempotent)", async () => {
    const repo = repository();
    const member = await new MemberService(repo, () => NOW).createMember(TEST_IDENTITY, { displayName: "Lena", color: "GREEN" });
    expect(member).toEqual({ userId: "LENA", displayName: "Lena", color: "GREEN", active: true });
    expect(repo.saveMembers).toHaveBeenCalledWith("default", [...SEED_MEMBERS, LENA], 0, "STEFAN", TS);
  });

  it("uses an explicit userId and the stored version", async () => {
    const repo = repository({ members: [...SEED_MEMBERS], membersVersion: 3 });
    await new MemberService(repo, () => NOW).createMember(TEST_IDENTITY, { userId: "KID_1", displayName: "Kind", color: "ORANGE" });
    expect(repo.saveMembers.mock.calls[0]?.[1].map((m) => m.userId)).toEqual(["STEFAN", "JULIA", "KID_1"]);
    expect(repo.saveMembers.mock.calls[0]?.[2]).toBe(3);
  });

  it("rejects duplicate IDs, underivable IDs and too many members", async () => {
    const service = new MemberService(repository(), () => NOW);
    await expect(service.createMember(TEST_IDENTITY, { displayName: "Stefan", color: "RED" })).rejects.toMatchObject({ code: "MEMBER_EXISTS", statusCode: 409 });
    await expect(service.createMember(TEST_IDENTITY, { displayName: "123", color: "RED" })).rejects.toBeInstanceOf(ValidationError);
    const many = Array.from({ length: 20 }, (_, i) => ({ ...LENA, userId: `M${i}` }));
    await expect(new MemberService(repository({ members: many, membersVersion: 1 }), () => NOW).createMember(TEST_IDENTITY, { displayName: "Neu", color: "RED" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("renames and recolors a member; the userId stays", async () => {
    const repo = repository({ members: [...SEED_MEMBERS, LENA], membersVersion: 2 });
    const updated = await new MemberService(repo, () => NOW).updateMember(TEST_IDENTITY, "LENA", { displayName: "Lena Marie" });
    expect(updated).toEqual({ userId: "LENA", displayName: "Lena Marie", color: "GREEN", active: true });
    expect(repo.saveMembers.mock.calls[0]?.[1][2]).toMatchObject({ userId: "LENA", displayName: "Lena Marie", updatedAt: TS });
    await expect(new MemberService(repo, () => NOW).updateMember(TEST_IDENTITY, "NOBODY", { color: "RED" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("derives IDs from names", () => {
    expect(slugify("Lena")).toBe("LENA");
    expect(slugify("Jörg-Ümit Groß")).toBe("JOERG_UEMIT_GROSS");
    expect(slugify("  René  ")).toBe("RENE");
    expect(slugify("x".repeat(40))).toHaveLength(30);
  });
});

describe("validation uses the stored members", () => {
  const members = async () => [...SEED_MEMBERS, LENA];
  const request = { title: "Spielzeug aufräumen", category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 1, frequencyUnit: "DAY", frequencyInterval: 1, weekdays: null, assignmentMode: "FIXED", rotation: null } as const;

  it("accepts new members and rejects unknown ones on create", async () => {
    const repo = mockTennerRepository();
    const service = new CreateTennerService(repo, () => NOW, () => "t-1", async () => "UTC", members);
    await expect(service.createTenner(TEST_IDENTITY, { ...request, assignedTo: "LENA" })).resolves.toMatchObject({ assignedTo: "LENA" });
    await expect(service.createTenner(TEST_IDENTITY, { ...request, assignedTo: "BOB" })).rejects.toMatchObject({ statusCode: 400, details: [{ field: "assignedTo", message: "Unknown household member." }] });
  });

  it("checks assignedTo on update only when it changes", async () => {
    const repo = mockTennerRepository();
    repo.update.mockResolvedValue(tennerFixture());
    const membersOf = vi.fn(members);
    const service = new UpdateTennerService(repo, () => NOW, membersOf);
    await service.updateTenner(TEST_IDENTITY, "t-1", { title: "Neu" });
    expect(membersOf).not.toHaveBeenCalled();
    await expect(service.updateTenner(TEST_IDENTITY, "t-1", { assignedTo: "BOB" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects completions for unknown members", async () => {
    const repo = mockTennerRepository();
    repo.getById.mockResolvedValue(tennerFixture());
    const service = new CompleteTennerService(repo, mockCompletionRepository(), () => NOW, () => "c-1", async () => "UTC", async () => null, members);
    await expect(service.completeTenner(TEST_IDENTITY, "t-1", { completedBy: "BOB" })).rejects.toMatchObject({ details: [{ field: "completedBy" }] });
    expect(repo.completeTenner).not.toHaveBeenCalled();
  });

  it("accepts household groups of new members and offers them in onboarding", async () => {
    const event = { requestContext: { authorizer: { jwt: { claims: { "cognito:groups": "[household:default:LENA_2]" } } } } } as never;
    expect(identityFromEvent(event)).toEqual({ tenantId: "default", userId: "LENA_2" });
    const memberships = { groupsOf: vi.fn(async () => []), memberCount: vi.fn(async () => 0), addMember: vi.fn(), removeMember: vi.fn(), ensureGroup: vi.fn(), removeAllMembers: vi.fn() };
    const service = new HouseholdAssignmentService(memberships, "default", members);
    await expect(service.getOnboarding({ username: "google_1" })).resolves.toMatchObject({ members: [{ userId: "STEFAN" }, { userId: "JULIA" }, { userId: "LENA", displayName: "Lena" }] });
    await expect(service.assign({ username: "google_1" }, "BOB")).rejects.toBeInstanceOf(NotFoundError);
    expect(memberships.addMember).not.toHaveBeenCalled();
    memberships.memberCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(service.assign({ username: "google_1" }, "LENA")).resolves.toMatchObject({ group: "household:default:LENA" });
    expect(memberships.ensureGroup).toHaveBeenCalledWith("household:default:LENA");
  });
});

describe("DynamoDbHouseholdRepository members", () => {
  const client = (impl: () => Promise<unknown>) => ({ send: vi.fn<(command: unknown) => Promise<unknown>>(impl) });

  it("reads members and drops malformed entries", async () => {
    const c = client(async () => ({ Item: { tenantId: "default", membersVersion: 2, members: [LENA, { userId: "bad id", displayName: "x" }, { ...LENA, userId: "MAX", color: "GOLD" }, "x"] } }));
    const settings = await new DynamoDbHouseholdRepository(c, "t").get("default");
    expect(settings?.members?.map((m) => [m.userId, m.color])).toEqual([["LENA", "GREEN"], ["MAX", "GREY"]]);
    expect(settings?.membersVersion).toBe(2);
  });

  it("saves with optimistic locking on membersVersion", async () => {
    const c = client(async () => ({ Attributes: { tenantId: "default", members: [LENA], membersVersion: 1 } }));
    const repo = new DynamoDbHouseholdRepository(c, "tenner-households");
    await repo.saveMembers("default", [LENA], 0, "STEFAN", TS);
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({ ConditionExpression: "attribute_not_exists(#version)", ExpressionAttributeNames: { "#list": "members", "#version": "membersVersion" }, ExpressionAttributeValues: { ":nextVersion": 1 } });
    await repo.saveMembers("default", [LENA], 4, "STEFAN", TS);
    expect((c.send.mock.calls[1]?.[0] as UpdateCommand).input).toMatchObject({ ConditionExpression: "#version = :expectedVersion", ExpressionAttributeValues: { ":expectedVersion": 4, ":nextVersion": 5 } });
  });

  it("maps conflicts and failures", async () => {
    const failing = (error: Error) => new DynamoDbHouseholdRepository(client(async () => Promise.reject(error)), "t");
    await expect(failing(Object.assign(new Error("c"), { name: "ConditionalCheckFailedException" })).saveMembers("d", [], 1, "STEFAN", TS)).rejects.toBeInstanceOf(ConflictError);
    await expect(failing(new Error("x")).saveMembers("d", [], 1, "STEFAN", TS)).rejects.toBeInstanceOf(PersistenceError);
    await expect(new DynamoDbHouseholdRepository(client(async () => ({})), "t").saveMembers("d", [], 1, "STEFAN", TS)).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("member handlers", () => {
  const event = (body: unknown, userId?: string) => ({ body: JSON.stringify(body), isBase64Encoded: false, pathParameters: userId ? { userId } : undefined }) as unknown as APIGatewayProxyEventV2;
  const lena = { userId: "LENA", displayName: "Lena", color: "GREEN" as const, active: true };

  it("lists, creates (201) and updates members with logging", async () => {
    expect(JSON.parse((await listMembersHandler("default", async () => [lena])).body ?? "").data).toEqual([lena]);
    const logger = mockLogger();
    const create = vi.fn(async () => lena);
    const created = await createMemberHandler(event({ displayName: " Lena ", color: "GREEN" }), TEST_IDENTITY, create, logger);
    expect(created.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(TEST_IDENTITY, { displayName: "Lena", color: "GREEN" });
    expect(logger.info).toHaveBeenCalledWith("Household member created", { event: "MemberCreated", userId: "LENA", createdBy: "STEFAN" });
    const update = vi.fn(async () => lena);
    await updateMemberHandler(event({ color: "RED" }, "LENA"), TEST_IDENTITY, update, logger);
    expect(update).toHaveBeenCalledWith(TEST_IDENTITY, "LENA", { color: "RED" });
    expect(logger.info).toHaveBeenCalledWith("Household member updated", { event: "MemberUpdated", userId: "LENA", changedFields: ["color"], updatedBy: "STEFAN" });
  });

  it.each([
    ["missing name", { color: "GREEN" }],
    ["blank name", { displayName: "  ", color: "GREEN" }],
    ["name over 40 characters", { displayName: "x".repeat(41), color: "GREEN" }],
    ["unknown color", { displayName: "Lena", color: "GOLD" }],
    ["invalid userId", { userId: "lena", displayName: "Lena", color: "GREEN" }],
    ["unknown fields", { displayName: "Lena", color: "GREEN", active: false }],
  ])("rejects %s on create", async (_name, body) => {
    await expect(createMemberHandler(event(body), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects empty updates, userId changes and invalid path IDs", async () => {
    await expect(updateMemberHandler(event({}, "LENA"), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
    await expect(updateMemberHandler(event({ userId: "X" }, "LENA"), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
    await expect(updateMemberHandler(event({ color: "RED" }, "lena"), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
  });
});
