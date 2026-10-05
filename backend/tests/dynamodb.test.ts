import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { getDocumentClient, PROBE_KEY, probeTables, type DocumentSender } from "../src/clients/dynamodb.js";

const tables = { tenners: "tenner-tenners", history: "tenner-history", households: "tenner-households" };

function sender(impl: DocumentSender["send"]): DocumentSender & { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn(impl) };
}

describe("probeTables", () => {
  it("returns true when all tables answer", async () => {
    const client = sender(async () => ({}));
    await expect(probeTables(client, tables)).resolves.toBe(true);
    expect(client.send).toHaveBeenCalledTimes(3);
  });

  it("reads a non-existent probe key from each configured table", async () => {
    const client = sender(async () => ({}));
    await probeTables(client, tables);
    const inputs = client.send.mock.calls.map(([command]) => (command as GetCommand).input);
    expect(inputs).toEqual([
      { TableName: "tenner-tenners", Key: { ...PROBE_KEY, tennerId: "__healthcheck__" } },
      { TableName: "tenner-history", Key: { ...PROBE_KEY, historyId: "__healthcheck__" } },
      { TableName: "tenner-households", Key: { ...PROBE_KEY } },
    ]);
  });

  it("returns false when a table call fails (e.g. AccessDenied)", async () => {
    const client = sender(async (command) => {
      if ((command as GetCommand).input.TableName === "tenner-history") throw new Error("AccessDeniedException");
      return {};
    });
    await expect(probeTables(client, tables)).resolves.toBe(false);
  });

  it("aborts and returns false after the timeout", async () => {
    const client = sender(
      (_command, options) =>
        new Promise((_resolve, reject) => {
          options?.abortSignal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    await expect(probeTables(client, tables, 10)).resolves.toBe(false);
  });
});

describe("getDocumentClient", () => {
  it("reuses one client per container", () => {
    expect(getDocumentClient()).toBe(getDocumentClient());
  });
});
