/** Verifies production wiring in createDependencies with a fake DynamoDB DocumentClient. */

import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tennerFixture, testConfig, TEST_IDENTITY } from "./mocks/index.js";

const send = vi.fn();

vi.mock("../src/clients/dynamodb.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/clients/dynamodb.js")>();
  return { ...original, getDocumentClient: () => ({ send }) };
});

const cognitoSend = vi.fn();

vi.mock("../src/clients/cognito.js", () => ({ getCognitoClient: () => ({ send: cognitoSend }) }));

const { createDependencies } = await import("../src/index.js");

afterEach(() => {
  send.mockReset();
  cognitoSend.mockReset();
  vi.restoreAllMocks();
});

function deps() {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  return createDependencies(testConfig());
}

describe("createDependencies wiring", () => {
  it("probes both configured tables", async () => {
    send.mockResolvedValue({});
    await expect(deps().probeDatabase({ tenners: "tenner-tenners", history: "tenner-history", households: "tenner-households" })).resolves.toBe(true);
    expect(send.mock.calls.every(([command]) => command instanceof GetCommand)).toBe(true);
  });

  it("creates Tenners in the configured tenners table", async () => {
    send.mockResolvedValue({});
    const created = await deps().createTenner(TEST_IDENTITY, {
      title: "Vacuum Office",
      category: "HOUSEHOLD",
      estimatedMinutes: 10,
      frequencyDays: 14,
      frequencyUnit: "DAY",
      frequencyInterval: 14,
      weekdays: null,
      assignedTo: "STEFAN",
    });
    const command = send.mock.calls.map(([c]) => c).find((c) => c instanceof PutCommand) as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input.TableName).toBe("tenner-tenners");
    expect(command.input.Item?.tennerId).toBe(created.tennerId);
  });

  it("lists Tenners from the configured table", async () => {
    send.mockResolvedValue({ Items: [tennerFixture()] });
    await expect(deps().listTenners("default", {})).resolves.toHaveLength(1);
    expect((send.mock.calls[0]?.[0] as QueryCommand).input.TableName).toBe("tenner-tenners");
  });

  it("soft deletes Tenners in the configured table", async () => {
    send.mockResolvedValue({ Attributes: tennerFixture({ active: false, deletedAt: "2026-10-01T18:00:00Z" }) });
    await expect(deps().deleteTenner(TEST_IDENTITY, "t-1")).resolves.toMatchObject({ response: { deleted: true } });
    expect((send.mock.calls[0]?.[0] as UpdateCommand).input.TableName).toBe("tenner-tenners");
  });

  it("completes Tenners with a transaction across both tables", async () => {
    send.mockImplementation(async (command: unknown) => (command instanceof GetCommand ? { Item: tennerFixture() } : {}));
    await expect(deps().completeTenner(TEST_IDENTITY, "t-1", { completedBy: "STEFAN" })).resolves.toMatchObject({ replayed: false });
    const transaction = send.mock.calls.map(([c]) => c).find((c) => c instanceof TransactWriteCommand) as TransactWriteCommand;
    expect(transaction.input.TransactItems?.map((i) => i.Put?.TableName ?? i.Update?.TableName)).toEqual(["tenner-history", "tenner-tenners"]);
  });

  it("undoes completions with a transaction across both tables", async () => {
    send.mockImplementation(async (command: unknown) => {
      if (command instanceof GetCommand) return { Item: tennerFixture({ lastCompleted: "2026-10-01T10:00:00Z" }) };
      if (command instanceof QueryCommand) return { Items: [{ tenantId: "default", historyId: "c-1", tennerId: "t-1", completedBy: "STEFAN", completedAt: "2026-10-01T10:00:00Z", actualMinutes: 10 }] };
      return {};
    });
    await expect(deps().undoCompletion(TEST_IDENTITY, "t-1", { revertedBy: "STEFAN" })).resolves.toMatchObject({ restoredPrevious: false });
    const transaction = send.mock.calls.map(([c]) => c).find((c) => c instanceof TransactWriteCommand) as TransactWriteCommand;
    expect(transaction.input.TransactItems?.map((i) => i.Update?.TableName)).toEqual(["tenner-history", "tenner-tenners"]);
  });

  it("restores Tenners in the configured table", async () => {
    send.mockImplementation(async (command: unknown) =>
      command instanceof GetCommand ? { Item: tennerFixture({ active: false, deletedAt: "2026-10-01T00:00:00Z" }) } : { Attributes: tennerFixture() },
    );
    await expect(deps().restoreTenner(TEST_IDENTITY, "t-1")).resolves.toMatchObject({ status: "RESTORED" });
  });

  it("serves the dashboard from the nextDue-index query plus the active Tenners for the paused section (SCHEDULING-005)", async () => {
    send.mockResolvedValue({ Items: [tennerFixture({ nextDue: "2026-10-01" })] });
    await expect(deps().getDashboard("default", { date: "2026-10-01" })).resolves.toMatchObject({ summary: { dueTodayCount: 1 } });
    const queries = send.mock.calls.map(([c]) => c).filter((c) => c instanceof QueryCommand) as QueryCommand[];
    expect(queries.map((q) => q.input.IndexName)).toEqual(["nextDue-index", undefined]);
  });

  it("reads and saves the household timezone in the households table (SCHEDULING-008)", async () => {
    send.mockImplementation(async (command: unknown) => (command instanceof GetCommand ? { Item: { tenantId: "default", timezone: "Asia/Tokyo", updatedAt: "x" } } : { Attributes: { tenantId: "default", timezone: "UTC", updatedAt: "y", updatedBy: "STEFAN" } }));
    await expect(deps().getHousehold("default")).resolves.toMatchObject({ timezone: "Asia/Tokyo", vacation: null, name: "Unser Haushalt" });
    expect((send.mock.calls[0]?.[0] as GetCommand).input).toEqual({ TableName: "tenner-households", Key: { tenantId: "default" } });
    await expect(deps().updateHousehold(TEST_IDENTITY, { timezone: "UTC" })).resolves.toMatchObject({ timezone: "UTC", vacation: null });
    expect((send.mock.calls.at(-1)?.[0] as UpdateCommand).input.TableName).toBe("tenner-households");
  });

  it("falls back to the configured timezone when the household has none", async () => {
    send.mockResolvedValue({});
    await expect(deps().getHousehold("default")).resolves.toMatchObject({ timezone: "Europe/Berlin", vacation: null });
  });

  it("reads a single Tenner with GetItem", async () => {
    send.mockResolvedValue({ Item: tennerFixture() });
    await expect(deps().getTenner("default", "t-1", {})).resolves.toMatchObject({ title: "Vacuum Office" });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetCommand);
  });

  it("reads history with titles", async () => {
    send.mockImplementation(async (command: unknown) =>
      command instanceof QueryCommand
        ? { Items: [{ tenantId: "default", historyId: "c-1", tennerId: "t-1", completedBy: "STEFAN", completedAt: "2026-10-01T10:00:00Z", actualMinutes: 10 }] }
        : { Responses: { "tenner-tenners": [{ tennerId: "t-1", title: "Vacuum Office" }] } },
    );
    await expect(deps().getHistory("default", {})).resolves.toMatchObject({ items: [{ tennerTitle: "Vacuum Office" }], nextCursor: null });
    send.mockImplementation(async (command: unknown) => (command instanceof GetCommand ? { Item: tennerFixture() } : { Items: [] }));
    await expect(deps().getTennerHistory("default", "t-1", {})).resolves.toEqual({ items: [], nextCursor: null });
  });

  it("updates Tenners in the configured table", async () => {
    send.mockResolvedValue({ Attributes: tennerFixture({ title: "New title" }) });
    await expect(deps().updateTenner(TEST_IDENTITY, "t-1", { title: "New title" })).resolves.toMatchObject({ title: "New title" });
    expect((send.mock.calls[0]?.[0] as UpdateCommand).input.TableName).toBe("tenner-tenners");
  });

  it("assigns household members through Cognito groups of the configured pool (HOTFIX-001)", async () => {
    send.mockResolvedValue({});
    cognitoSend.mockImplementation(async (command: { constructor: { name: string } }) =>
      command.constructor.name === "AdminListGroupsForUserCommand" ? { Groups: [] } : command.constructor.name === "ListUsersInGroupCommand" ? { Users: [] } : {},
    );
    await expect(deps().getOnboarding({ username: "google_1" })).resolves.toMatchObject({ assignedTo: null });
    cognitoSend.mockClear();
    let added = false;
    cognitoSend.mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === "AdminAddUserToGroupCommand") added = true;
      if (command.constructor.name === "ListUsersInGroupCommand") return { Users: added ? [{}] : [] };
      return { Groups: [] };
    });
    await expect(deps().assignHouseholdMember({ username: "google_1" }, "STEFAN")).resolves.toMatchObject({ group: "household:default:STEFAN" });
    expect(cognitoSend.mock.calls.map(([c]) => (c as { input: { UserPoolId: string } }).input.UserPoolId)).toEqual(Array(5).fill("eu-central-1_TEST"));
  });

  it("reports 503 for onboarding when Cognito is not configured", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await expect(createDependencies(testConfig({ onboarding: undefined })).getOnboarding({ username: "u" })).rejects.toMatchObject({ statusCode: 503 });
  });
});
