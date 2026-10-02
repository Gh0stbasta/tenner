/** Verifies production wiring in createDependencies with a fake DynamoDB DocumentClient. */

import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tennerFixture, testConfig } from "./mocks/index.js";

const send = vi.fn();

vi.mock("../src/clients/dynamodb.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/clients/dynamodb.js")>();
  return { ...original, getDocumentClient: () => ({ send }) };
});

const { createDependencies } = await import("../src/index.js");

afterEach(() => {
  send.mockReset();
  vi.restoreAllMocks();
});

function deps() {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  return createDependencies(testConfig());
}

describe("createDependencies wiring", () => {
  it("probes both configured tables", async () => {
    send.mockResolvedValue({});
    await expect(deps().probeDatabase({ tenners: "tenner-tenners", history: "tenner-history" })).resolves.toBe(true);
    expect(send.mock.calls.every(([command]) => command instanceof GetCommand)).toBe(true);
  });

  it("creates Tenners in the configured tenners table", async () => {
    send.mockResolvedValue({});
    const created = await deps().createTenner("default", {
      title: "Vacuum Office",
      category: "HOUSEHOLD",
      estimatedMinutes: 10,
      frequencyDays: 14,
      assignedTo: "STEFAN",
    });
    const command = send.mock.calls[0]?.[0] as PutCommand;
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
    await expect(deps().deleteTenner("default", "t-1")).resolves.toMatchObject({ response: { deleted: true } });
    expect((send.mock.calls[0]?.[0] as UpdateCommand).input.TableName).toBe("tenner-tenners");
  });

  it("completes Tenners with a transaction across both tables", async () => {
    send.mockImplementation(async (command: unknown) => (command instanceof GetCommand ? { Item: tennerFixture() } : {}));
    await expect(deps().completeTenner("default", "t-1", { completedBy: "STEFAN" })).resolves.toMatchObject({ replayed: false });
    const transaction = send.mock.calls.map(([c]) => c).find((c) => c instanceof TransactWriteCommand) as TransactWriteCommand;
    expect(transaction.input.TransactItems?.map((i) => i.Put?.TableName ?? i.Update?.TableName)).toEqual(["tenner-history", "tenner-tenners"]);
  });

  it("undoes completions with a transaction across both tables", async () => {
    send.mockImplementation(async (command: unknown) => {
      if (command instanceof GetCommand) return { Item: tennerFixture({ lastCompleted: "2026-10-01T10:00:00Z" }) };
      if (command instanceof QueryCommand) return { Items: [{ tenantId: "default", historyId: "c-1", tennerId: "t-1", completedBy: "STEFAN", completedAt: "2026-10-01T10:00:00Z", actualMinutes: 10 }] };
      return {};
    });
    await expect(deps().undoCompletion("default", "t-1", { revertedBy: "STEFAN" })).resolves.toMatchObject({ restoredPrevious: false });
    const transaction = send.mock.calls.map(([c]) => c).find((c) => c instanceof TransactWriteCommand) as TransactWriteCommand;
    expect(transaction.input.TransactItems?.map((i) => i.Update?.TableName)).toEqual(["tenner-history", "tenner-tenners"]);
  });

  it("restores Tenners in the configured table", async () => {
    send.mockImplementation(async (command: unknown) =>
      command instanceof GetCommand ? { Item: tennerFixture({ active: false, deletedAt: "2026-10-01T00:00:00Z" }) } : { Attributes: tennerFixture() },
    );
    await expect(deps().restoreTenner("default", "t-1")).resolves.toMatchObject({ status: "RESTORED" });
  });

  it("serves the dashboard from one nextDue-index query", async () => {
    send.mockResolvedValue({ Items: [tennerFixture({ nextDue: "2026-10-01" })] });
    await expect(deps().getDashboard("default", { date: "2026-10-01" })).resolves.toMatchObject({ summary: { dueTodayCount: 1 } });
    expect((send.mock.calls[0]?.[0] as QueryCommand).input.IndexName).toBe("nextDue-index");
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
    await expect(deps().updateTenner("default", "t-1", { title: "New title" })).resolves.toMatchObject({ title: "New title" });
    expect((send.mock.calls[0]?.[0] as UpdateCommand).input.TableName).toBe("tenner-tenners");
  });
});
