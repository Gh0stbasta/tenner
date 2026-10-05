import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { getHouseholdHandler, updateHouseholdHandler } from "../src/handlers/household.js";
import { DynamoDbHouseholdRepository, type HouseholdRepository } from "../src/repositories/index.js";
import { DashboardService, HouseholdService, ListTennersService } from "../src/services/index.js";
import type { ApiEvent } from "../src/types/api.js";
import { mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-05T08:00:00Z");

function memoryRepository(timezone?: string): HouseholdRepository & { saveTimezone: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(async (tenantId: string) => (timezone ? { tenantId, timezone, updatedAt: "t", updatedBy: null } : undefined)),
    saveTimezone: vi.fn(async (tenantId: string, tz: string, actor, timestamp: string) => ({ tenantId, timezone: tz, updatedAt: timestamp, updatedBy: actor })),
  };
}

describe("HouseholdService", () => {
  it("returns the stored timezone or the configured default (getHouseholdTimezone)", async () => {
    await expect(new HouseholdService(memoryRepository("Asia/Tokyo"), () => NOW, "Europe/Berlin").timezoneOf("default")).resolves.toBe("Asia/Tokyo");
    await expect(new HouseholdService(memoryRepository(), () => NOW, "Europe/Berlin").getHousehold("default")).resolves.toEqual({ timezone: "Europe/Berlin" });
  });

  it("saves the timezone with the acting user and time", async () => {
    const repository = memoryRepository();
    await expect(new HouseholdService(repository, () => NOW, "Europe/Berlin").updateTimezone(TEST_IDENTITY, "America/New_York")).resolves.toEqual({ timezone: "America/New_York" });
    expect(repository.saveTimezone).toHaveBeenCalledWith("default", "America/New_York", "STEFAN", "2026-10-05T08:00:00Z");
  });
});

describe("household handlers", () => {
  const event = (body: unknown): ApiEvent => ({ routeKey: "PUT /household", body: JSON.stringify(body) }) as unknown as ApiEvent;

  it("GET returns the household timezone", async () => {
    const response = await getHouseholdHandler("default", async () => ({ timezone: "Europe/Berlin" }));
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: { timezone: "Europe/Berlin" } });
  });

  it("PUT saves a valid IANA timezone and logs the change", async () => {
    const logger = mockLogger();
    const update = vi.fn(async (_identity, timezone: string) => ({ timezone }));
    const response = await updateHouseholdHandler(event({ timezone: " Europe/Vienna " }), TEST_IDENTITY, update, logger);
    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(TEST_IDENTITY, "Europe/Vienna");
    expect(logger.info).toHaveBeenCalledWith("Household timezone changed", { event: "HouseholdTimezoneChanged", timezone: "Europe/Vienna" });
  });

  it.each([{ timezone: "Mars/Olympus" }, { timezone: "" }, { timezone: "Europe/Berlin; rm" }, { timezone: "x".repeat(65) }, {}, { timezone: "UTC", name: "x" }])(
    "invalid timezone rejected: %j",
    async (body) => {
      const update = vi.fn();
      await expect(updateHouseholdHandler(event(body), TEST_IDENTITY, update, mockLogger())).rejects.toBeInstanceOf(ValidationError);
      expect(update).not.toHaveBeenCalled();
    },
  );
});

describe("DynamoDbHouseholdRepository", () => {
  const client = (impl: () => Promise<unknown>) => ({ send: vi.fn<(command: unknown) => Promise<unknown>>(() => impl()) });

  it("reads the item by tenant and ignores items without timezone", async () => {
    const c = client(async () => ({ Item: { tenantId: "default", timezone: "Europe/Berlin", updatedAt: "t", updatedBy: "JULIA" } }));
    await expect(new DynamoDbHouseholdRepository(c, "tenner-households").get("default")).resolves.toEqual({ tenantId: "default", timezone: "Europe/Berlin", updatedAt: "t", updatedBy: "JULIA" });
    expect((c.send.mock.calls[0]?.[0] as GetCommand).input).toEqual({ TableName: "tenner-households", Key: { tenantId: "default" } });
    await expect(new DynamoDbHouseholdRepository(client(async () => ({ Item: { tenantId: "default" } })), "t").get("default")).resolves.toBeUndefined();
    await expect(new DynamoDbHouseholdRepository(client(async () => ({})), "t").get("default")).resolves.toBeUndefined();
  });

  it("upserts only the timezone fields", async () => {
    const c = client(async () => ({ Attributes: { tenantId: "default", timezone: "UTC", updatedAt: "ts", updatedBy: "STEFAN" } }));
    await expect(new DynamoDbHouseholdRepository(c, "tenner-households").saveTimezone("default", "UTC", "STEFAN", "ts")).resolves.toMatchObject({ timezone: "UTC", updatedBy: "STEFAN" });
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({
      Key: { tenantId: "default" },
      UpdateExpression: "SET #timezone = :timezone, #updatedAt = :timestamp, #updatedBy = :actor",
    });
  });

  it("maps failures and empty update responses to PersistenceError", async () => {
    const failing = new DynamoDbHouseholdRepository(client(async () => Promise.reject(new Error("x"))), "t");
    await expect(failing.get("default")).rejects.toBeInstanceOf(PersistenceError);
    await expect(failing.saveTimezone("default", "UTC", "STEFAN", "ts")).rejects.toBeInstanceOf(PersistenceError);
    await expect(new DynamoDbHouseholdRepository(client(async () => ({})), "t").saveTimezone("default", "UTC", "STEFAN", "ts")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("local 'today' (SCHEDULING-008)", () => {
  // 2 Oct 2026 00:30 in Berlin = 1 Oct 22:30 UTC
  const justAfterLocalMidnight = () => new Date("2026-10-01T22:30:00Z");

  it("dashboard today boundary follows local midnight", async () => {
    const repository = mockTennerRepository();
    repository.getDashboardCandidates.mockResolvedValue([tennerFixture({ tennerId: "a", nextDue: "2026-10-02" }), tennerFixture({ tennerId: "b", nextDue: "2026-10-01" })]);
    const berlin = await new DashboardService(repository, justAfterLocalMidnight, async () => "Europe/Berlin").getDashboard("default");
    expect(berlin).toMatchObject({ referenceDate: "2026-10-02", timezone: "Europe/Berlin", summary: { dueTodayCount: 1, overdueCount: 1 } });
    const utc = await new DashboardService(repository, justAfterLocalMidnight, async () => "UTC").getDashboard("default");
    expect(utc).toMatchObject({ referenceDate: "2026-10-01", summary: { dueTodayCount: 1, overdueCount: 0, upcomingCount: 1 } });
  });

  it("list due/overdue filters use the household-local today; plain lists do not read the timezone", async () => {
    const repository = mockTennerRepository();
    repository.list.mockResolvedValue([]);
    const timezoneOf = vi.fn(async () => "Europe/Berlin");
    const service = new ListTennersService(repository, justAfterLocalMidnight, timezoneOf);
    await service.listTenners("default", { overdue: true });
    expect(repository.list).toHaveBeenLastCalledWith("default", expect.objectContaining({ nextDueBefore: "2026-10-02" }));
    await service.listTenners("default", {});
    expect(timezoneOf).toHaveBeenCalledTimes(1);
  });
});
