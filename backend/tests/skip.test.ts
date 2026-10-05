/** SCHEDULING-004: skip one occurrence. */

import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { skipTennerHandler } from "../src/handlers/skip-tenner.js";
import type { Tenner } from "../src/models/index.js";
import { DynamoDbTennerRepository } from "../src/repositories/index.js";
import { nextDueAfterSkip, SkipTennerService } from "../src/services/index.js";
import { mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

// Monday, 5 Oct 2026, 20:00 in Berlin.
const NOW = new Date("2026-10-05T18:00:00Z");
const TODAY = "2026-10-05";
const OVERDUE = tennerFixture({ tennerId: "t-1", nextDue: "2026-10-01", lastCompleted: "2026-09-17T08:00:00Z", snoozedUntil: null });

function setup(tenner: Tenner = OVERDUE) {
  const tenners = mockTennerRepository();
  tenners.getById.mockResolvedValue(tenner);
  tenners.skipTenner.mockResolvedValue(undefined);
  return { tenners, service: new SkipTennerService(tenners, () => NOW, () => "k-1", async () => "Europe/Berlin") };
}

describe("SkipTennerService", () => {
  it("advances the due date by one cycle from today and keeps lastCompleted", async () => {
    const { tenners, service } = setup();
    const response = await service.skipTenner(TEST_IDENTITY, "t-1", { reason: "Not needed this week" });
    const [updated, event, expected] = tenners.skipTenner.mock.calls[0] ?? [];
    expect(updated).toMatchObject({ nextDue: "2026-10-19", lastCompleted: "2026-09-17T08:00:00Z", snoozedUntil: null, updatedBy: "STEFAN" });
    expect(expected).toBe(OVERDUE);
    expect(event).toEqual({
      tenantId: "default",
      skipId: "k-1",
      tennerId: "t-1",
      skippedBy: "STEFAN",
      skippedAt: "2026-10-05T18:00:00Z",
      skippedDue: "2026-10-01",
      nextDue: "2026-10-19",
      reason: "Not needed this week",
    });
    expect(response.tenner).toMatchObject({ nextDue: "2026-10-19", lastCompleted: "2026-09-17T08:00:00Z" });
    expect(response.skip).toEqual({ skipId: "k-1", skippedBy: "STEFAN", skippedAt: "2026-10-05T18:00:00Z", skippedDue: "2026-10-01", nextDue: "2026-10-19", reason: "Not needed this week" });
  });

  it("clears an active snooze and stores a missing reason as null", async () => {
    const { tenners, service } = setup(tennerFixture({ nextDue: TODAY, snoozedUntil: TODAY }));
    await service.skipTenner(TEST_IDENTITY, "t-1", {});
    expect(tenners.skipTenner.mock.calls[0]?.[0].snoozedUntil).toBeNull();
    expect(tenners.skipTenner.mock.calls[0]?.[1].reason).toBeNull();
  });

  it.each([
    ["inactive", tennerFixture({ active: false })],
    ["archived", tennerFixture({ deletedAt: "2026-10-01T00:00:00Z" })],
  ])("rejects %s Tenners with 409 TENNER_INACTIVE", async (_name, tenner) => {
    const { tenners, service } = setup(tenner);
    await expect(service.skipTenner(TEST_IDENTITY, "t-1", {})).rejects.toMatchObject({ code: "TENNER_INACTIVE", statusCode: 409 });
    expect(tenners.skipTenner).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown Tenners and propagates conflicts", async () => {
    const { tenners, service } = setup();
    tenners.getById.mockResolvedValueOnce(undefined);
    await expect(service.skipTenner(TEST_IDENTITY, "nope", {})).rejects.toBeInstanceOf(NotFoundError);
    tenners.skipTenner.mockRejectedValue(new ConflictError("modified", "CONCURRENT_MODIFICATION"));
    await expect(service.skipTenner(TEST_IDENTITY, "t-1", {})).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  });
});

describe("nextDueAfterSkip", () => {
  const weekly = { frequencyUnit: "WEEK", frequencyInterval: 1, weekdays: null } as const;

  it("counts from today for due and overdue Tenners", () => {
    expect(nextDueAfterSkip({ ...weekly, nextDue: TODAY }, TODAY)).toBe("2026-10-12");
    expect(nextDueAfterSkip({ ...weekly, nextDue: "2026-09-28" }, TODAY)).toBe("2026-10-12");
  });

  it("counts from the due date for Tenners that are not due yet, so a skip never moves them earlier", () => {
    expect(nextDueAfterSkip({ ...weekly, nextDue: "2026-10-20" }, TODAY)).toBe("2026-10-27");
  });

  it("respects calendar months and weekdays", () => {
    expect(nextDueAfterSkip({ frequencyUnit: "MONTH", frequencyInterval: 1, weekdays: null, nextDue: "2026-10-31" }, "2026-10-31")).toBe("2026-11-30");
    expect(nextDueAfterSkip({ frequencyUnit: "WEEK", frequencyInterval: 1, weekdays: ["SAT"], nextDue: "2026-10-03" }, TODAY)).toBe("2026-10-10");
  });
});

describe("DynamoDbTennerRepository.skipTenner", () => {
  const expected = tennerFixture({ tennerId: "t-1", updatedAt: "2026-09-17T10:00:00Z" });
  const updated = { ...expected, nextDue: "2026-10-19", updatedAt: "2026-10-05T18:00:00Z" };
  const event = { tenantId: "default", skipId: "k-1", tennerId: "t-1", skippedBy: "STEFAN", skippedAt: "2026-10-05T18:00:00Z", skippedDue: "2026-10-01", nextDue: "2026-10-19", reason: null } as const;

  it("writes a SKIP event outside the completion indexes and the schedule in one transaction", async () => {
    const send = vi.fn<(command: unknown) => Promise<unknown>>(async () => ({}));
    await new DynamoDbTennerRepository({ send }, "tenner-tenners", "tenner-history").skipTenner(updated, event, expected);
    const command = send.mock.calls[0]?.[0] as TransactWriteCommand;
    const [put, update] = command.input.TransactItems ?? [];
    expect(put?.Put?.Item).toEqual({
      tenantId: "default",
      historyId: "skip#k-1",
      eventType: "SKIP",
      tennerId: "t-1",
      skippedBy: "STEFAN",
      skippedAt: "2026-10-05T18:00:00Z",
      skippedDue: "2026-10-01",
      nextDue: "2026-10-19",
      reason: null,
    });
    expect(put?.Put?.Item).not.toHaveProperty("completedAt");
    expect(update?.Update?.ExpressionAttributeValues).toMatchObject({ ":nextDue": "2026-10-19", ":snoozedUntil": null, ":expectedUpdatedAt": "2026-09-17T10:00:00Z" });
  });

  it.each([
    ["Tenner changed", Object.assign(new Error("c"), { name: "TransactionCanceledException", CancellationReasons: [{ Code: "None" }, { Code: "ConditionalCheckFailed" }] }), ConflictError],
    ["other failure", new Error("boom"), PersistenceError],
  ])("maps %s", async (_name, error, type) => {
    const send = vi.fn<(command: unknown) => Promise<unknown>>(async () => {
      throw error;
    });
    await expect(new DynamoDbTennerRepository({ send }, "tenner-tenners", "tenner-history").skipTenner(updated, event, expected)).rejects.toBeInstanceOf(type);
  });
});

describe("skipTennerHandler", () => {
  const request = (body: string | undefined) => ({ body, isBase64Encoded: false, pathParameters: { tennerId: "t-1" } }) as unknown as APIGatewayProxyEventV2;
  const result = {
    tenner: { tennerId: "t-1" },
    skip: { skipId: "k-1", skippedBy: "STEFAN", skippedAt: "2026-10-05T18:00:00Z", skippedDue: "2026-10-01", nextDue: "2026-10-19", reason: "private plans" },
  } as never;

  it("accepts an empty body and does not log the reason text", async () => {
    const logger = mockLogger();
    const skip = vi.fn(async () => result);
    const response = await skipTennerHandler(request(undefined), TEST_IDENTITY, skip, logger);
    expect(response.statusCode).toBe(200);
    expect(skip).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", {});
    expect(logger.info).toHaveBeenCalledWith("Tenner skipped", { event: "TennerSkipped", tennerId: "t-1", skippedBy: "STEFAN", skippedDue: "2026-10-01", nextDue: "2026-10-19", withReason: true });
  });

  it("trims the reason", async () => {
    const skip = vi.fn(async () => result);
    await skipTennerHandler(request(JSON.stringify({ reason: "  Not needed  " })), TEST_IDENTITY, skip, mockLogger());
    expect(skip).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", { reason: "Not needed" });
  });

  it.each([
    ["a reason over 200 characters", { reason: "x".repeat(201) }],
    ["a blank reason", { reason: "   " }],
    ["unknown fields", { nextDue: "2026-10-19" }],
  ])("rejects %s", async (_name, body) => {
    const skip = vi.fn();
    await expect(skipTennerHandler(request(JSON.stringify(body)), TEST_IDENTITY, skip, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(skip).not.toHaveBeenCalled();
  });

  it("accepts exactly 200 characters", async () => {
    const skip = vi.fn(async () => result);
    await skipTennerHandler(request(JSON.stringify({ reason: "x".repeat(200) })), TEST_IDENTITY, skip, mockLogger());
    expect(skip).toHaveBeenCalledOnce();
  });
});
