/** SCHEDULING-003: snooze / postpone a Tenner. */

import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { snoozeTennerHandler } from "../src/handlers/snooze-tenner.js";
import type { Tenner } from "../src/models/index.js";
import { DynamoDbTennerRepository } from "../src/repositories/index.js";
import { CompleteTennerService, maxSnoozeDate, SnoozeTennerService } from "../src/services/index.js";
import { mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

// 5 Oct 2026, 23:30 in Berlin (21:30 UTC): "today" is the household-local date.
const NOW = new Date("2026-10-05T21:30:00Z");
const TODAY = "2026-10-05";

function setup(tenner: Tenner = tennerFixture({ tennerId: "t-1", nextDue: TODAY, frequencyDays: 7, frequencyInterval: 7 }), timezone = "Europe/Berlin") {
  const tenners = mockTennerRepository();
  tenners.getById.mockResolvedValue(tenner);
  tenners.snoozeTenner.mockResolvedValue(undefined);
  return { tenners, service: new SnoozeTennerService(tenners, () => NOW, () => "s-1", async () => timezone) };
}

async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (error: unknown) => error,
  );
}

describe("SnoozeTennerService", () => {
  it("snoozes by days from the household-local today and records an audit event", async () => {
    const { tenners, service } = setup();
    const response = await service.snoozeTenner(TEST_IDENTITY, "t-1", { days: 3 });
    const [updated, event, expected] = tenners.snoozeTenner.mock.calls[0] ?? [];
    expect(updated).toMatchObject({ nextDue: "2026-10-08", snoozedUntil: "2026-10-08", updatedAt: "2026-10-05T21:30:00Z", updatedBy: "STEFAN" });
    expect(event).toEqual({
      tenantId: "default",
      snoozeId: "s-1",
      tennerId: "t-1",
      snoozedBy: "STEFAN",
      snoozedAt: "2026-10-05T21:30:00Z",
      previousNextDue: TODAY,
      snoozedUntil: "2026-10-08",
    });
    expect(expected?.nextDue).toBe(TODAY);
    expect(response.tenner).toMatchObject({ nextDue: "2026-10-08", snoozedUntil: "2026-10-08", lastCompleted: null });
    expect(response.snooze).toEqual({ snoozeId: "s-1", snoozedBy: "STEFAN", snoozedAt: "2026-10-05T21:30:00Z", previousNextDue: TODAY, snoozedUntil: "2026-10-08" });
  });

  it("snoozes until a date", async () => {
    const { tenners, service } = setup();
    await service.snoozeTenner(TEST_IDENTITY, "t-1", { until: "2026-10-10" });
    expect(tenners.snoozeTenner.mock.calls[0]?.[0].nextDue).toBe("2026-10-10");
  });

  it("uses the household timezone for today (UTC would still be 5 Oct, Tokyo is already 6 Oct)", async () => {
    const { tenners, service } = setup(undefined, "Asia/Tokyo");
    await service.snoozeTenner(TEST_IDENTITY, "t-1", { days: 1 });
    expect(tenners.snoozeTenner.mock.calls[0]?.[0].nextDue).toBe("2026-10-07");
  });

  it.each([
    ["a past date", "2026-10-01", "Must be after today."],
    ["today", TODAY, "Must be after today."],
  ])("rejects %s", async (_name, until, message) => {
    const { tenners, service } = setup();
    const error = await rejection(service.snoozeTenner(TEST_IDENTITY, "t-1", { until }));
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details).toEqual([{ field: "until", message }]);
    expect(tenners.snoozeTenner).not.toHaveBeenCalled();
  });

  it("rejects dates not after the current due date (snoozing never pulls a Tenner forward)", async () => {
    const { service } = setup(tennerFixture({ nextDue: "2026-10-09" }));
    const error = (await rejection(service.snoozeTenner(TEST_IDENTITY, "t-1", { days: 2 }))) as ValidationError;
    expect(error.details).toEqual([{ field: "days", message: "Must be after the current due date 2026-10-09." }]);
  });

  it("enforces the maximum: 30 days for short frequencies", async () => {
    const { service } = setup();
    await expect(service.snoozeTenner(TEST_IDENTITY, "t-1", { days: 30 })).resolves.toBeDefined();
    const error = (await rejection(service.snoozeTenner(TEST_IDENTITY, "t-1", { days: 31 }))) as ValidationError;
    expect(error.details?.[0]?.message).toBe("Must not be later than 2026-11-04 (one frequency interval or 30 days).");
  });

  it("enforces the maximum: one interval for long frequencies", async () => {
    const quarterly = tennerFixture({ nextDue: TODAY, frequencyDays: 90, frequencyUnit: "MONTH", frequencyInterval: 3 });
    const { service } = setup(quarterly);
    await expect(service.snoozeTenner(TEST_IDENTITY, "t-1", { until: "2027-01-05" })).resolves.toBeDefined();
    await expect(service.snoozeTenner(TEST_IDENTITY, "t-1", { until: "2027-01-06" })).rejects.toBeInstanceOf(ValidationError);
    expect(maxSnoozeDate("2026-10-31", { frequencyUnit: "MONTH", frequencyInterval: 1 })).toBe("2026-11-30");
    expect(maxSnoozeDate("2026-10-05", { frequencyUnit: "YEAR", frequencyInterval: 1 })).toBe("2027-10-05");
  });

  it.each([
    ["inactive", tennerFixture({ active: false })],
    ["archived", tennerFixture({ deletedAt: "2026-10-01T00:00:00Z" })],
  ])("rejects %s Tenners with 409 TENNER_INACTIVE", async (_name, tenner) => {
    const { tenners, service } = setup(tenner);
    await expect(service.snoozeTenner(TEST_IDENTITY, "t-1", { days: 1 })).rejects.toMatchObject({ code: "TENNER_INACTIVE", statusCode: 409 });
    expect(tenners.snoozeTenner).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown Tenners", async () => {
    const { tenners, service } = setup();
    tenners.getById.mockResolvedValue(undefined);
    await expect(service.snoozeTenner(TEST_IDENTITY, "nope", { days: 1 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propagates concurrent modifications", async () => {
    const { tenners, service } = setup();
    tenners.snoozeTenner.mockRejectedValue(new ConflictError("modified", "CONCURRENT_MODIFICATION"));
    await expect(service.snoozeTenner(TEST_IDENTITY, "t-1", { days: 1 })).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  });
});

describe("completion clears the snooze", () => {
  it("sets snoozedUntil to null on completion", async () => {
    const tenners = mockTennerRepository();
    const snoozed = tennerFixture({ nextDue: "2026-10-08", snoozedUntil: "2026-10-08" });
    tenners.getById.mockResolvedValue(snoozed);
    tenners.completeTenner.mockResolvedValue(undefined);
    const service = new CompleteTennerService(tenners, mockCompletionRepository(), () => NOW, () => "c-1", async () => "UTC");
    const outcome = await service.completeTenner(TEST_IDENTITY, "t-1", {});
    expect(tenners.completeTenner.mock.calls[0]?.[0].snoozedUntil).toBeNull();
    expect(outcome.response.tenner.snoozedUntil).toBeNull();
  });
});

describe("DynamoDbTennerRepository.snoozeTenner", () => {
  const expected = tennerFixture({ tennerId: "t-1", updatedAt: "2026-09-17T10:00:00Z" });
  const updated = { ...expected, nextDue: "2026-10-08", snoozedUntil: "2026-10-08", updatedAt: "2026-10-05T21:30:00Z" };
  const event = { tenantId: "default", snoozeId: "s-1", tennerId: "t-1", snoozedBy: "STEFAN", snoozedAt: "2026-10-05T21:30:00Z", previousNextDue: "2026-10-01", snoozedUntil: "2026-10-08" } as const;

  it("writes the audit event (outside the completion indexes) and the schedule in one transaction", async () => {
    const send = vi.fn<(command: unknown) => Promise<unknown>>(async () => ({}));
    await new DynamoDbTennerRepository({ send }, "tenner-tenners", "tenner-history").snoozeTenner(updated, event, expected);
    const command = send.mock.calls[0]?.[0] as TransactWriteCommand;
    expect(command).toBeInstanceOf(TransactWriteCommand);
    const [put, update] = command.input.TransactItems ?? [];
    expect(put?.Put).toEqual({
      TableName: "tenner-history",
      Item: { tenantId: "default", historyId: "snooze#s-1", eventType: "SNOOZE", tennerId: "t-1", snoozedBy: "STEFAN", snoozedAt: "2026-10-05T21:30:00Z", previousNextDue: "2026-10-01", snoozedUntil: "2026-10-08" },
      ConditionExpression: "attribute_not_exists(historyId)",
    });
    // History readers use the completedAt GSIs; without completedAt/tenantTennerId the event is never indexed.
    expect(put?.Put?.Item).not.toHaveProperty("completedAt");
    expect(put?.Put?.Item).not.toHaveProperty("tenantTennerId");
    expect(update?.Update).toMatchObject({
      TableName: "tenner-tenners",
      Key: { tenantId: "default", tennerId: "t-1" },
      UpdateExpression: "SET #nextDue = :nextDue, #snoozedUntil = :snoozedUntil, #updatedAt = :updatedAt, #updatedBy = :updatedBy",
      ConditionExpression: "#updatedAt = :expectedUpdatedAt AND #active = :true AND (attribute_not_exists(#deletedAt) OR #deletedAt = :null)",
    });
    expect(update?.Update?.ExpressionAttributeValues).toMatchObject({ ":nextDue": "2026-10-08", ":snoozedUntil": "2026-10-08", ":expectedUpdatedAt": "2026-09-17T10:00:00Z" });
  });

  const cancelled = (codes: string[]) => Object.assign(new Error("c"), { name: "TransactionCanceledException", CancellationReasons: codes.map((Code) => ({ Code })) });

  it.each([
    ["Tenner changed", cancelled(["None", "ConditionalCheckFailed"]), ConflictError],
    ["other failure", new Error("boom"), PersistenceError],
  ])("maps %s", async (_name, error, type) => {
    const send = vi.fn<(command: unknown) => Promise<unknown>>(async () => {
      throw error;
    });
    await expect(new DynamoDbTennerRepository({ send }, "tenner-tenners", "tenner-history").snoozeTenner(updated, event, expected)).rejects.toBeInstanceOf(type);
  });
});

describe("snoozeTennerHandler", () => {
  const request = (body: unknown, tennerId = "t-1") =>
    ({ body: JSON.stringify(body), isBase64Encoded: false, pathParameters: { tennerId } }) as unknown as APIGatewayProxyEventV2;
  const result = {
    tenner: { tennerId: "t-1" },
    snooze: { snoozeId: "s-1", snoozedBy: "STEFAN", snoozedAt: "2026-10-05T21:30:00Z", previousNextDue: TODAY, snoozedUntil: "2026-10-08" },
  } as never;

  it("returns 200 and logs a TennerSnoozed event", async () => {
    const logger = mockLogger();
    const snooze = vi.fn(async () => result);
    const response = await snoozeTennerHandler(request({ days: 3 }), TEST_IDENTITY, snooze, logger);
    expect(response.statusCode).toBe(200);
    expect(snooze).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", { days: 3 });
    expect(logger.info).toHaveBeenCalledWith("Tenner snoozed", { event: "TennerSnoozed", tennerId: "t-1", snoozedBy: "STEFAN", previousNextDue: TODAY, snoozedUntil: "2026-10-08" });
  });

  it.each([
    ["neither until nor days", {}],
    ["both until and days", { until: "2026-10-08", days: 3 }],
    ["an invalid date", { until: "2026-02-30" }],
    ["zero days", { days: 0 }],
    ["fractional days", { days: 1.5 }],
    ["unknown fields", { days: 1, nextDue: "2026-10-08" }],
  ])("rejects %s", async (_name, body) => {
    const snooze = vi.fn();
    await expect(snoozeTennerHandler(request(body), TEST_IDENTITY, snooze, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(snooze).not.toHaveBeenCalled();
  });
});
