import { describe, expect, it, vi, type Mocked } from "vitest";
import { principalFromEvent } from "../src/auth/index.js";
import { ConflictError, PersistenceError, UnauthorizedError, ValidationError } from "../src/exceptions/index.js";
import { assignHouseholdMemberHandler, onboardingHandler } from "../src/handlers/onboarding.js";
import { CognitoHouseholdMembershipRepository, type HouseholdMembershipRepository } from "../src/repositories/index.js";
import { HouseholdAssignmentService } from "../src/services/index.js";
import type { ApiEvent } from "../src/types/api.js";
import { authenticatedEvent, mockLogger } from "./mocks/index.js";
import { SEED_MEMBERS } from "../src/models/index.js";

const ME = { username: "google_111" };
const STEFAN = "household:default:STEFAN";
const JULIA = "household:default:JULIA";

/** In-memory membership store: group → usernames. */
function store(initial: Record<string, string[]> = {}): Mocked<HouseholdMembershipRepository> & { groups: Map<string, Set<string>> } {
  const groups = new Map(Object.entries(initial).map(([group, users]) => [group, new Set(users)]));
  const members = (group: string) => groups.get(group) ?? groups.set(group, new Set()).get(group) ?? new Set<string>();
  return {
    groups,
    groupsOf: vi.fn(async (username: string) => [...groups].filter(([, users]) => users.has(username)).map(([group]) => group)),
    memberCount: vi.fn(async (group: string) => Math.min(members(group).size, 2)),
    addMember: vi.fn(async (username: string, group: string) => void members(group).add(username)),
    removeMember: vi.fn(async (username: string, group: string) => void members(group).delete(username)),
    ensureGroup: vi.fn(async () => undefined),
    removeAllMembers: vi.fn(async () => 0),
  };
}

const SEEDED = async () => SEED_MEMBERS;

describe("HouseholdAssignmentService.getOnboarding", () => {
  it("first login: not assigned, both members available", async () => {
    await expect(new HouseholdAssignmentService(store(), "default", SEEDED).getOnboarding(ME)).resolves.toEqual({
      assignedTo: null,
      members: [
        { userId: "STEFAN", displayName: "Stefan", available: true },
        { userId: "JULIA", displayName: "Julia", available: true },
      ],
    });
  });

  it("existing assignment: reports the member (the client skips onboarding)", async () => {
    const result = await new HouseholdAssignmentService(store({ [STEFAN]: ["google_111"] }), "default", SEEDED).getOnboarding(ME);
    expect(result.assignedTo).toBe("STEFAN");
    expect(result.members.find((m) => m.userId === "STEFAN")?.available).toBe(false);
  });

  it("marks members claimed by other accounts as unavailable", async () => {
    const result = await new HouseholdAssignmentService(store({ [JULIA]: ["google_222"] }), "default", SEEDED).getOnboarding(ME);
    expect(result).toMatchObject({ assignedTo: null, members: [{ userId: "STEFAN", available: true }, { userId: "JULIA", available: false }] });
  });
});

describe("HouseholdAssignmentService.assign", () => {
  it.each([
    ["STEFAN", STEFAN],
    ["JULIA", JULIA],
  ] as const)("assigns %s to a free account", async (userId, group) => {
    const memberships = store();
    await expect(new HouseholdAssignmentService(memberships, "default", SEEDED).assign(ME, userId)).resolves.toEqual({ response: { userId }, group });
    expect(memberships.groups.get(group)).toEqual(new Set(["google_111"]));
  });

  it("rejects a second assignment of the same account (ALREADY_ASSIGNED)", async () => {
    const memberships = store({ [STEFAN]: ["google_111"] });
    await expect(new HouseholdAssignmentService(memberships, "default", SEEDED).assign(ME, "JULIA")).rejects.toMatchObject({ code: "ALREADY_ASSIGNED", statusCode: 409 });
    expect(memberships.addMember).not.toHaveBeenCalled();
  });

  it("rejects a member claimed by another account (MEMBER_TAKEN): strangers cannot take over", async () => {
    const memberships = store({ [JULIA]: ["google_222"] });
    await expect(new HouseholdAssignmentService(memberships, "default", SEEDED).assign(ME, "JULIA")).rejects.toMatchObject({ code: "MEMBER_TAKEN", statusCode: 409 });
    expect(memberships.addMember).not.toHaveBeenCalled();
  });

  it("withdraws when a concurrent claim of the same member wins the race", async () => {
    const memberships = store();
    memberships.addMember.mockImplementationOnce(async (username, group) => {
      memberships.groups.set(group, new Set(["google_222", username])); // the other account was added at the same time
    });
    await expect(new HouseholdAssignmentService(memberships, "default", SEEDED).assign(ME, "JULIA")).rejects.toBeInstanceOf(ConflictError);
    expect(memberships.removeMember).toHaveBeenCalledWith("google_111", JULIA);
    expect(memberships.groups.get(JULIA)).toEqual(new Set(["google_222"]));
  });

  it("uses the configured tenant in the group name", async () => {
    const memberships = store();
    await new HouseholdAssignmentService(memberships, "household-2", SEEDED).assign(ME, "STEFAN");
    expect(memberships.addMember).toHaveBeenCalledWith("google_111", "household:household-2:STEFAN");
  });
});

describe("onboarding handlers", () => {
  const event = (body: unknown): ApiEvent => authenticatedEvent({ routeKey: "POST /onboarding/assignment", body: JSON.stringify(body) });

  it("GET returns the onboarding state", async () => {
    const response = await onboardingHandler(ME, async () => ({ assignedTo: null, members: [] }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: { assignedTo: null, members: [] } });
  });

  it("POST assigns, returns 201 and writes an audit log without the e-mail", async () => {
    const logger = mockLogger();
    const assign = vi.fn().mockResolvedValue({ response: { userId: "JULIA" }, group: JULIA });
    const response = await assignHouseholdMemberHandler(event({ userId: "JULIA" }), ME, assign, logger);
    expect(response.statusCode).toBe(201);
    expect(assign).toHaveBeenCalledWith(ME, "JULIA");
    expect(logger.info).toHaveBeenCalledWith("Household member assigned", { event: "HouseholdMemberAssigned", username: "google_111", userId: "JULIA", group: JULIA });
  });

  it.each([{ userId: "bob" }, {}, { userId: "JULIA", tenantId: "other" }])("POST rejects %j with 400", async (body) => {
    const assign = vi.fn();
    await expect(assignHouseholdMemberHandler(event(body), ME, assign, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("principalFromEvent", () => {
  it("reads cognito:username from the verified claims", () => {
    expect(principalFromEvent(authenticatedEvent({ routeKey: "GET /onboarding" }, { "cognito:username": "google_9" }))).toEqual({ username: "google_9" });
  });

  it.each([null, {}, { "cognito:username": " " }])("rejects %j with 401", (claims) => {
    expect(() => principalFromEvent(authenticatedEvent({ routeKey: "GET /onboarding" }, claims))).toThrow(UnauthorizedError);
  });
});

describe("CognitoHouseholdMembershipRepository", () => {
  const client = (impl: (command: { input: Record<string, unknown> }) => Promise<unknown>) => ({ send: vi.fn(impl) });

  it("maps the Cognito API calls", async () => {
    const c = client(async (command) => {
      const name = command.constructor.name;
      if (name === "AdminListGroupsForUserCommand") return { Groups: [{ GroupName: STEFAN }, {}] };
      if (name === "ListUsersInGroupCommand") return { Users: [{}, {}, {}] };
      return {};
    });
    const repository = new CognitoHouseholdMembershipRepository(c as never, "pool-1");
    await expect(repository.groupsOf("google_1")).resolves.toEqual([STEFAN]);
    await expect(repository.memberCount(STEFAN)).resolves.toBe(2);
    await repository.addMember("google_1", STEFAN);
    await repository.removeMember("google_1", STEFAN);
    const inputs = c.send.mock.calls.map(([command]) => [command.constructor.name, command.input]);
    expect(inputs).toEqual([
      ["AdminListGroupsForUserCommand", { UserPoolId: "pool-1", Username: "google_1", Limit: 60 }],
      ["ListUsersInGroupCommand", { UserPoolId: "pool-1", GroupName: STEFAN, Limit: 2 }],
      ["AdminAddUserToGroupCommand", { UserPoolId: "pool-1", Username: "google_1", GroupName: STEFAN }],
      ["AdminRemoveUserFromGroupCommand", { UserPoolId: "pool-1", Username: "google_1", GroupName: STEFAN }],
    ]);
  });

  it("handles empty responses", async () => {
    const repository = new CognitoHouseholdMembershipRepository(client(async () => ({})) as never, "pool-1");
    await expect(repository.groupsOf("u")).resolves.toEqual([]);
    await expect(repository.memberCount(STEFAN)).resolves.toBe(0);
  });

  it("maps every failure to PersistenceError", async () => {
    const repository = new CognitoHouseholdMembershipRepository(client(async () => Promise.reject(new Error("AccessDenied"))) as never, "pool-1");
    await expect(repository.groupsOf("u")).rejects.toBeInstanceOf(PersistenceError);
    await expect(repository.memberCount(STEFAN)).rejects.toBeInstanceOf(PersistenceError);
    await expect(repository.addMember("u", STEFAN)).rejects.toBeInstanceOf(PersistenceError);
    await expect(repository.removeMember("u", STEFAN)).rejects.toBeInstanceOf(PersistenceError);
    await expect(repository.ensureGroup(STEFAN)).rejects.toBeInstanceOf(PersistenceError);
  });

  it("creates missing groups idempotently and counts a missing group as free (HOUSEHOLD-ADMIN-001)", async () => {
    const named = (name: string) => Object.assign(new Error(name), { name });
    const c = client(async (command) => {
      if (command.constructor.name === "CreateGroupCommand") throw named("GroupExistsException");
      throw named("ResourceNotFoundException");
    });
    const repository = new CognitoHouseholdMembershipRepository(c as never, "pool-1");
    await expect(repository.ensureGroup("household:default:LENA")).resolves.toBeUndefined();
    expect(c.send.mock.calls[0]?.[0].input).toMatchObject({ UserPoolId: "pool-1", GroupName: "household:default:LENA" });
    await expect(repository.memberCount("household:default:LENA")).resolves.toBe(0);
  });
});

describe("members without login (HOUSEHOLD-ADMIN-006)", () => {
  const WITH_HELP = async () => [...SEED_MEMBERS, { userId: "HILFE", displayName: "Haushaltshilfe", color: "TEAL" as const, active: true, canSignIn: false, createdAt: "t", updatedAt: "t" }];

  it("are never offered on the first login", async () => {
    const result = await new HouseholdAssignmentService(store(), "default", WITH_HELP).getOnboarding(ME);
    expect(result.members.map((member) => member.userId)).toEqual(["STEFAN", "JULIA"]);
  });

  it("cannot be claimed, even when all other members are taken", async () => {
    const memberships = store({ [STEFAN]: ["google_1"], [JULIA]: ["google_2"] });
    await expect(new HouseholdAssignmentService(memberships, "default", WITH_HELP).assign(ME, "HILFE")).rejects.toMatchObject({ statusCode: 404 });
    expect(memberships.addMember).not.toHaveBeenCalled();
  });
});
