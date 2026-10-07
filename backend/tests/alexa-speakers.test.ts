/** ALEXA-002: access tokens, Alexa channel, Alexa context and speaker mappings. */

import type { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { clientOf, identityFromEvent, principalFromEvent } from "../src/auth/index.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/exceptions/index.js";
import { linkAlexaSpeakerHandler, registerAlexaUserHandler, unlinkAlexaSpeakerHandler, alexaContextHandler } from "../src/handlers/alexa.js";
import { SEED_MEMBERS, type AlexaSpeaker, type HouseholdMember, type HouseholdSettings } from "../src/models/index.js";
import { DynamoDbHouseholdRepository } from "../src/repositories/index.js";
import { AlexaSpeakerService } from "../src/services/index.js";
import { loadConfig } from "../src/config.js";
import { authenticatedEvent, householdSettings, mockLogger, TEST_IDENTITY } from "./mocks/index.js";

const PERSON = "amzn1.ask.person.ABCDEF123";
const OTHER_PERSON = "amzn1.ask.person.XYZ";
const NOW = new Date("2026-10-05T08:00:00Z");
const LENA: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: false, canSignIn: true, createdAt: "t", updatedAt: "t" };

/** Cognito access token claims as the HTTP API JWT authorizer passes them (no aud, username instead of cognito:username). */
const accessTokenClaims = (groups = "[household:default:STEFAN]") => ({
  sub: "11111111-2222-3333-4444-555555555555",
  "cognito:groups": groups,
  username: "google_123456789",
  client_id: "alexa-client",
  token_use: "access",
  scope: "openid tenner/household",
});

describe("access tokens (ALEXA-002)", () => {
  const event = (claims: Record<string, string>) => authenticatedEvent({ routeKey: "GET /dashboard" }, claims);

  it("accepts an access token: household from cognito:groups, principal from username", () => {
    expect(identityFromEvent(event(accessTokenClaims()))).toEqual(TEST_IDENTITY);
    expect(principalFromEvent(event(accessTokenClaims()))).toEqual({ username: "google_123456789" });
  });

  it("rejects an access token without household group with 403", () => {
    expect(() => identityFromEvent(event(accessTokenClaims("[eu-central-1_TEST_Google]")))).toThrow(ForbiddenError);
  });

  it("names the channel from client_id (access token) or aud (ID token)", () => {
    expect(clientOf(event(accessTokenClaims()), "alexa-client")).toBe("alexa");
    expect(clientOf(event({ ...accessTokenClaims(), client_id: "web-client" }), "alexa-client")).toBe("web");
    expect(clientOf(event({ aud: "alexa-client" }), "alexa-client")).toBe("alexa");
    expect(clientOf(event(accessTokenClaims()), undefined)).toBe("web");
    expect(clientOf(authenticatedEvent({ routeKey: "GET /health" }, null), "alexa-client")).toBe("web");
  });

  it("reads ALEXA_CLIENT_ID from the environment", () => {
    expect(loadConfig({ ALEXA_CLIENT_ID: " abc " }).alexaClientId).toBe("abc");
    expect(loadConfig({}).alexaClientId).toBeUndefined();
  });
});

/** In-memory household item with optimistic locking like DynamoDB. */
function world(settings: Partial<HouseholdSettings> | undefined = {}) {
  let household: HouseholdSettings | undefined = settings === undefined ? undefined : householdSettings({ members: [...SEED_MEMBERS, LENA], membersVersion: 1, ...settings });
  const households = {
    get: vi.fn(async () => household),
    saveAlexaSpeakers: vi.fn(async (_tenantId: string, alexaSpeakers: readonly AlexaSpeaker[], expectedVersion: number) => {
      const current = household ?? householdSettings();
      if (expectedVersion !== current.alexaSpeakersVersion) throw new ConflictError("changed", "CONCURRENT_MODIFICATION");
      household = { ...current, alexaSpeakers, alexaSpeakersVersion: expectedVersion + 1 };
      return household;
    }),
    saveAlexaUsers: vi.fn(async (_tenantId: string, alexaUsers: HouseholdSettings["alexaUsers"], expectedVersion: number) => {
      const current = household ?? householdSettings();
      if (expectedVersion !== current.alexaUsersVersion) throw new ConflictError("changed", "CONCURRENT_MODIFICATION");
      household = { ...current, alexaUsers, alexaUsersVersion: expectedVersion + 1 };
      return household;
    }),
  };
  return { service: new AlexaSpeakerService(households, () => NOW, "Europe/Berlin"), households, household: () => household };
}

const speaker = (personId: string, userId: string): AlexaSpeaker => ({ personId, userId, createdAt: "t", createdBy: "STEFAN" });

describe("AlexaSpeakerService", () => {
  it("returns the account member, active members and mappings", async () => {
    const w = world({ alexaSpeakers: [speaker(PERSON, "JULIA"), speaker(OTHER_PERSON, "LENA")] });
    expect(await w.service.context(TEST_IDENTITY)).toEqual({
      account: { userId: "STEFAN" },
      timezone: "Europe/Berlin",
      members: [
        { userId: "STEFAN", displayName: "Stefan" },
        { userId: "JULIA", displayName: "Julia" },
      ],
      // LENA is deactivated: her mapping is hidden.
      speakers: [{ personId: PERSON, userId: "JULIA" }],
      alexaAccounts: 0,
    });
  });

  it("falls back to the seed members without a household item", async () => {
    const context = await world(undefined).service.context(TEST_IDENTITY);
    expect(context.members.map((member) => member.userId)).toEqual(SEED_MEMBERS.map((member) => member.userId));
    expect(context.speakers).toEqual([]);
    expect(context.timezone).toBe("Europe/Berlin");
  });

  it("returns the household's own timezone", async () => {
    expect((await world({ timezone: "America/New_York" }).service.context(TEST_IDENTITY)).timezone).toBe("America/New_York");
  });

  it("creates, uses and replaces a mapping (Speaker Mapping Create / Use)", async () => {
    const w = world();
    const created = await w.service.link(TEST_IDENTITY, PERSON, "JULIA");
    expect(created.speakers).toEqual([{ personId: PERSON, userId: "JULIA" }]);
    expect(w.household()?.alexaSpeakers).toEqual([{ personId: PERSON, userId: "JULIA", createdAt: "2026-10-05T08:00:00Z", createdBy: "STEFAN" }]);
    const replaced = await w.service.link(TEST_IDENTITY, PERSON, "STEFAN");
    expect(replaced.speakers).toEqual([{ personId: PERSON, userId: "STEFAN" }]);
    expect(w.household()?.alexaSpeakersVersion).toBe(2);
  });

  it("does not write when the mapping already exists", async () => {
    const w = world({ alexaSpeakers: [speaker(PERSON, "JULIA")], alexaSpeakersVersion: 1 });
    await w.service.link(TEST_IDENTITY, PERSON, "JULIA");
    expect(w.households.saveAlexaSpeakers).not.toHaveBeenCalled();
  });

  it("rejects unknown and deactivated members", async () => {
    const w = world();
    await expect(w.service.link(TEST_IDENTITY, PERSON, "NOBODY")).rejects.toThrow(ValidationError);
    await expect(w.service.link(TEST_IDENTITY, PERSON, "LENA")).rejects.toThrow(ValidationError);
  });

  it("limits the number of mappings", async () => {
    const many = Array.from({ length: 20 }, (_, index) => speaker(`amzn1.ask.person.P${index}`, "JULIA"));
    const w = world({ alexaSpeakers: many, alexaSpeakersVersion: 1 });
    await expect(w.service.link(TEST_IDENTITY, PERSON, "JULIA")).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    // Replacing an existing speaker stays possible at the limit.
    await expect(w.service.link(TEST_IDENTITY, "amzn1.ask.person.P0", "STEFAN")).resolves.toBeDefined();
  });

  it("deletes a mapping and 404s for unknown ones (Speaker Mapping Delete)", async () => {
    const w = world({ alexaSpeakers: [speaker(PERSON, "JULIA"), speaker(OTHER_PERSON, "STEFAN")], alexaSpeakersVersion: 4 });
    const result = await w.service.unlink(TEST_IDENTITY, PERSON);
    expect(result.speakers).toEqual([{ personId: OTHER_PERSON, userId: "STEFAN" }]);
    expect(w.households.saveAlexaSpeakers).toHaveBeenCalledWith("default", [speaker(OTHER_PERSON, "STEFAN")], 4, "STEFAN", "2026-10-05T08:00:00Z");
    await expect(w.service.unlink(TEST_IDENTITY, PERSON)).rejects.toThrow(NotFoundError);
    await expect(world(undefined).service.unlink(TEST_IDENTITY, PERSON)).rejects.toThrow(NotFoundError);
  });
});

describe("Alexa accounts (ALEXA-007)", () => {
  const ACCOUNT = "amzn1.ask.account.AFAKEACCOUNTID";

  it("registers an Alexa account once and reports it in the context", async () => {
    const w = world();
    expect((await w.service.context(TEST_IDENTITY, ACCOUNT)).alexaUserKnown).toBe(false);
    await w.service.registerAlexaUser(TEST_IDENTITY, ACCOUNT);
    await w.service.registerAlexaUser(TEST_IDENTITY, ACCOUNT);
    expect(w.households.saveAlexaUsers).toHaveBeenCalledOnce();
    expect(w.household()?.alexaUsers).toEqual([{ alexaUserId: ACCOUNT, linkedBy: "STEFAN", createdAt: "2026-10-05T08:00:00Z" }]);
    expect(await w.service.context(TEST_IDENTITY, ACCOUNT)).toMatchObject({ alexaUserKnown: true, alexaAccounts: 1 });
    expect(await w.service.alexaUsersOf("default")).toEqual([ACCOUNT]);
    expect("alexaUserKnown" in (await w.service.context(TEST_IDENTITY))).toBe(false);
  });

  it("limits accounts and removes gone ones", async () => {
    const many = Array.from({ length: 10 }, (_, index) => ({ alexaUserId: `amzn1.ask.account.A${index}`, linkedBy: "STEFAN", createdAt: "t" }));
    await expect(world({ alexaUsers: many, alexaUsersVersion: 1 }).service.registerAlexaUser(TEST_IDENTITY, ACCOUNT)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    const w = world({ alexaUsers: many.slice(0, 2), alexaUsersVersion: 1 });
    await w.service.removeAlexaUser("default", "amzn1.ask.account.A0");
    expect(w.household()?.alexaUsers.map((user) => user.alexaUserId)).toEqual(["amzn1.ask.account.A1"]);
    expect(w.households.saveAlexaUsers).toHaveBeenCalledWith("default", expect.anything(), 1, "SYSTEM", expect.any(String));
    await w.service.removeAlexaUser("default", "amzn1.ask.account.A0");
    expect(w.households.saveAlexaUsers).toHaveBeenCalledOnce();
  });

  it("validates the account ID in path and query and logs no Amazon IDs", async () => {
    const logger = mockLogger();
    const register = vi.fn(async () => undefined);
    const event = authenticatedEvent({ pathParameters: { alexaUserId: ACCOUNT } });
    expect((await registerAlexaUserHandler(event, TEST_IDENTITY, register, logger)).statusCode).toBe(200);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(ACCOUNT);
    await expect(registerAlexaUserHandler(authenticatedEvent({ pathParameters: { alexaUserId: "x" } }), TEST_IDENTITY, register, logger)).rejects.toThrow(ValidationError);
    const getContext = vi.fn(async () => ({ account: { userId: "STEFAN" }, timezone: "UTC", members: [], speakers: [], alexaAccounts: 0 }));
    await alexaContextHandler(authenticatedEvent({ queryStringParameters: { alexaUserId: ACCOUNT } }), TEST_IDENTITY, getContext);
    expect(getContext).toHaveBeenCalledWith(TEST_IDENTITY, ACCOUNT);
    await expect(alexaContextHandler(authenticatedEvent({ queryStringParameters: { alexaUserId: "bad" } }), TEST_IDENTITY, getContext)).rejects.toThrow(ValidationError);
  });

  it("maps stored accounts and drops malformed ones", async () => {
    const client = { send: vi.fn<(command: unknown) => Promise<unknown>>(async () => ({ Item: { tenantId: "default", alexaUsersVersion: 1, alexaUsers: [{ alexaUserId: ACCOUNT, linkedBy: "STEFAN" }, { alexaUserId: "bad", linkedBy: "STEFAN" }, null] } })) };
    const settings = await new DynamoDbHouseholdRepository(client, "t").get("default");
    expect(settings?.alexaUsers).toEqual([{ alexaUserId: ACCOUNT, linkedBy: "STEFAN", createdAt: "" }]);
    const save = { send: vi.fn<(command: unknown) => Promise<unknown>>(async () => ({ Attributes: { tenantId: "default" } })) };
    await new DynamoDbHouseholdRepository(save, "t").saveAlexaUsers("default", [], 1, "STEFAN", "t");
    expect((save.send.mock.calls[0]?.[0] as UpdateCommand).input.ExpressionAttributeNames).toMatchObject({ "#list": "alexaUsers" });
  });
});

describe("Alexa handlers", () => {
  const pathEvent = (personId: string | undefined, body?: string) =>
    authenticatedEvent({ routeKey: "PUT /household/alexa-speakers/{personId}", pathParameters: personId === undefined ? {} : { personId }, ...(body ? { body } : {}) });
  const context = { account: { userId: "STEFAN" }, timezone: "Europe/Berlin", members: [], speakers: [], alexaAccounts: 0 };

  it("validates the person ID and body and logs without the person ID", async () => {
    const logger = mockLogger();
    const link = vi.fn(async () => context);
    const response = await linkAlexaSpeakerHandler(pathEvent(PERSON, JSON.stringify({ userId: "JULIA" })), TEST_IDENTITY, link, logger);
    expect(response.statusCode).toBe(200);
    expect(link).toHaveBeenCalledWith(TEST_IDENTITY, PERSON, "JULIA");
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(PERSON);
    await expect(linkAlexaSpeakerHandler(pathEvent("amzn1.ask.account.X", JSON.stringify({ userId: "JULIA" })), TEST_IDENTITY, link, logger)).rejects.toThrow(ValidationError);
    await expect(linkAlexaSpeakerHandler(pathEvent(PERSON, JSON.stringify({ userId: "JULIA", extra: 1 })), TEST_IDENTITY, link, logger)).rejects.toThrow(ValidationError);
  });

  it("unlinks and returns the context", async () => {
    const logger = mockLogger();
    const unlink = vi.fn(async () => context);
    expect((await unlinkAlexaSpeakerHandler(pathEvent(PERSON), TEST_IDENTITY, unlink, logger)).statusCode).toBe(200);
    await expect(unlinkAlexaSpeakerHandler(pathEvent(undefined), TEST_IDENTITY, unlink, logger)).rejects.toThrow(ValidationError);
    expect(JSON.parse((await alexaContextHandler(pathEvent(undefined), TEST_IDENTITY, async () => context)).body ?? "").data).toEqual(context);
  });
});

describe("DynamoDbHouseholdRepository (alexaSpeakers)", () => {
  const client = (send: (command: unknown) => Promise<unknown>) => ({ send: vi.fn(send) });

  it("reads mappings and drops malformed entries", async () => {
    const stored = { personId: PERSON, userId: "JULIA", createdAt: "c", createdBy: "STEFAN" };
    const c = client(async () => ({ Item: { tenantId: "default", alexaSpeakersVersion: 2, alexaSpeakers: [stored, { ...stored, personId: "bad" }, { ...stored, userId: "bad id" }, { personId: OTHER_PERSON, userId: "STEFAN" }, null] } }));
    const settings = await new DynamoDbHouseholdRepository(c, "t").get("default");
    expect(settings?.alexaSpeakers).toEqual([stored, { personId: OTHER_PERSON, userId: "STEFAN", createdAt: "", createdBy: "" }]);
    expect(settings?.alexaSpeakersVersion).toBe(2);
    const none = await new DynamoDbHouseholdRepository(client(async () => ({ Item: { tenantId: "default" } })), "t").get("default");
    expect(none).toMatchObject({ alexaSpeakers: [], alexaSpeakersVersion: 0 });
  });

  it("saves with optimistic locking on alexaSpeakersVersion", async () => {
    const c = client(async () => ({ Attributes: { tenantId: "default", alexaSpeakers: [], alexaSpeakersVersion: 1 } }));
    await new DynamoDbHouseholdRepository(c, "tenner-households").saveAlexaSpeakers("default", [], 0, "STEFAN", "t");
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({
      ConditionExpression: "attribute_not_exists(#version)",
      ExpressionAttributeNames: { "#list": "alexaSpeakers", "#version": "alexaSpeakersVersion" },
    });
  });
});
