import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { getHouseholdHandler, updateHouseholdHandler } from "../src/handlers/household.js";
import { SEED_CATEGORIES, type HouseholdSettings, type HouseholdSettingsChange } from "../src/models/index.js";
import { DynamoDbHouseholdRepository } from "../src/repositories/index.js";
import { DashboardService, HouseholdService, ListTennersService } from "../src/services/index.js";
import type { ApiEvent } from "../src/types/api.js";
import { householdSettings, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-05T08:00:00Z");

function memoryRepository(timezone?: string) {
  return {
    get: vi.fn(async () => (timezone ? householdSettings({ timezone }) : undefined)),
    saveSettings: vi.fn(async (_tenantId: string, changes: HouseholdSettingsChange, actor: string, timestamp: string) =>
      householdSettings({ ...(changes as Partial<HouseholdSettings>), updatedAt: timestamp, updatedBy: actor }),
    ),
  };
}

const DEFAULT_HOUSEHOLD = { name: "Unser Haushalt", timezone: "Europe/Berlin", weekStartsOn: "MONDAY", workdays: ["MON", "TUE", "WED", "THU", "FRI"], defaults: { category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14 }, defaultsSource: "DEFAULT", vacation: null, handovers: [] } as const;

describe("HouseholdService", () => {
  it("returns the stored timezone or the configured default (getHouseholdTimezone)", async () => {
    await expect(new HouseholdService(memoryRepository("Asia/Tokyo"), () => NOW, "Europe/Berlin").timezoneOf("default")).resolves.toBe("Asia/Tokyo");
  });

  it("returns default settings for a new household (HOUSEHOLD-ADMIN-003)", async () => {
    await expect(new HouseholdService(memoryRepository(), () => NOW, "Europe/Berlin").getHousehold("default")).resolves.toEqual(DEFAULT_HOUSEHOLD);
  });

  it("saves any subset of the settings with the acting user and time", async () => {
    const repository = memoryRepository();
    const service = new HouseholdService(repository, () => NOW, "Europe/Berlin");
    const result = await service.updateSettings(TEST_IDENTITY, { name: "Familie S.", workdays: ["MON", "WED"], defaults: { category: "FITNESS", estimatedMinutes: 30, frequencyDays: 7 } });
    expect(repository.saveSettings).toHaveBeenCalledWith(
      "default",
      { name: "Familie S.", workdays: ["MON", "WED"], defaults: { category: "FITNESS", estimatedMinutes: 30, frequencyDays: 7 } },
      "STEFAN",
      "2026-10-05T08:00:00Z",
    );
    expect(result).toMatchObject({ name: "Familie S.", workdays: ["MON", "WED"], defaultsSource: "HOUSEHOLD", timezone: "Europe/Berlin" });
    await expect(service.updateSettings(TEST_IDENTITY, { timezone: "America/New_York" })).resolves.toMatchObject({ timezone: "America/New_York" });
  });

  it("rejects unknown or archived default categories", async () => {
    const categories = SEED_CATEGORIES.map((c) => (c.categoryId === "FINANCE" ? { ...c, archived: true } : c));
    const service = new HouseholdService(memoryRepository(), () => NOW, "Europe/Berlin", async () => categories);
    await expect(service.updateSettings(TEST_IDENTITY, { defaults: { category: "PETS", estimatedMinutes: 5, frequencyDays: 7 } })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.updateSettings(TEST_IDENTITY, { defaults: { category: "FINANCE", estimatedMinutes: 5, frequencyDays: 7 } })).rejects.toBeInstanceOf(ValidationError);
  });

  it("exposes effective settings to backend consumers", async () => {
    const repository = memoryRepository();
    repository.get.mockResolvedValue(householdSettings({ weekStartsOn: "SUNDAY" }));
    await expect(new HouseholdService(repository, () => NOW, "UTC").settingsOf("default")).resolves.toMatchObject({ weekStartsOn: "SUNDAY", timezone: "UTC" });
  });
});

describe("household handlers", () => {
  const event = (body: unknown): ApiEvent => ({ routeKey: "PUT /household", body: JSON.stringify(body) }) as unknown as ApiEvent;

  it("GET returns the household settings", async () => {
    const response = await getHouseholdHandler("default", async () => DEFAULT_HOUSEHOLD);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: DEFAULT_HOUSEHOLD });
  });

  it("PUT saves valid settings and logs the changed fields", async () => {
    const logger = mockLogger();
    const update = vi.fn(async () => ({ ...DEFAULT_HOUSEHOLD, timezone: "Europe/Vienna" }));
    const response = await updateHouseholdHandler(event({ timezone: " Europe/Vienna ", workdays: ["FRI", "MON"], weekStartsOn: "SUNDAY" }), TEST_IDENTITY, update, logger);
    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(TEST_IDENTITY, { timezone: "Europe/Vienna", workdays: ["MON", "FRI"], weekStartsOn: "SUNDAY" });
    expect(logger.info).toHaveBeenCalledWith("Household settings changed", {
      event: "HouseholdSettingsChanged",
      changedFields: ["timezone", "weekStartsOn", "workdays"],
      changedBy: "STEFAN",
      timezone: "Europe/Vienna",
    });
  });

  it.each([
    { timezone: "Mars/Olympus" },
    { timezone: "" },
    { timezone: "Europe/Berlin; rm" },
    { timezone: "x".repeat(65) },
    {},
    { timezone: "UTC", extra: "x" },
    { name: " " },
    { name: "x".repeat(61) },
    { weekStartsOn: "FRIDAY" },
    { workdays: [] },
    { workdays: ["MON", "MON"] },
    { defaults: { category: "HOUSEHOLD", estimatedMinutes: 0, frequencyDays: 14 } },
    { defaults: { category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 4000 } },
    { defaults: { category: "household", estimatedMinutes: 10, frequencyDays: 14 } },
    { defaults: { category: "HOUSEHOLD", estimatedMinutes: 10 } },
  ])("invalid settings rejected: %j", async (body) => {
    const update = vi.fn();
    await expect(updateHouseholdHandler(event(body), TEST_IDENTITY, update, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("DynamoDbHouseholdRepository", () => {
  const client = (impl: () => Promise<unknown>) => ({ send: vi.fn<(command: unknown) => Promise<unknown>>(() => impl()) });

  it("reads the item by tenant; missing settings read as null", async () => {
    const c = client(async () => ({ Item: { tenantId: "default", timezone: "Europe/Berlin", updatedAt: "t", updatedBy: "JULIA" } }));
    await expect(new DynamoDbHouseholdRepository(c, "tenner-households").get("default")).resolves.toEqual(householdSettings({ timezone: "Europe/Berlin", updatedBy: "JULIA" }));
    expect((c.send.mock.calls[0]?.[0] as GetCommand).input).toEqual({ TableName: "tenner-households", Key: { tenantId: "default" } });
    await expect(new DynamoDbHouseholdRepository(client(async () => ({ Item: { tenantId: "default" } })), "t").get("default")).resolves.toMatchObject({ timezone: null, vacation: null });
    await expect(new DynamoDbHouseholdRepository(client(async () => ({})), "t").get("default")).resolves.toBeUndefined();
  });

  it("reads the vacation and ignores malformed values (SCHEDULING-005)", async () => {
    const read = (vacation: unknown) => new DynamoDbHouseholdRepository(client(async () => ({ Item: { tenantId: "default", vacation } })), "t").get("default");
    await expect(read({ from: "2026-10-10", until: "2026-10-24", categories: ["HOME", "bogus"] })).resolves.toMatchObject({ vacation: { from: "2026-10-10", until: "2026-10-24", categories: ["HOME"] } });
    await expect(read({ from: "2026-10-10", until: "2026-10-24", categories: null })).resolves.toMatchObject({ vacation: { categories: null } });
    await expect(read({ from: "2026-10-10" })).resolves.toMatchObject({ vacation: null });
    await expect(read("x")).resolves.toMatchObject({ vacation: null });
  });

  it("upserts only the vacation (SCHEDULING-005)", async () => {
    const c = client(async () => ({ Attributes: { tenantId: "default", vacation: null, members: null, membersVersion: 0, categories: null, categoriesVersion: 0, updatedAt: "ts", updatedBy: "STEFAN" } }));
    await new DynamoDbHouseholdRepository(c, "tenner-households").saveVacation("default", null, "STEFAN", "ts");
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({
      UpdateExpression: "SET #vacation = :vacation, #updatedAt = :timestamp, #updatedBy = :actor",
      ExpressionAttributeNames: { "#vacation": "vacation" },
      ExpressionAttributeValues: { ":vacation": null },
    });
  });

  it("upserts only the given settings (undefined fields are skipped)", async () => {
    const c = client(async () => ({ Attributes: { tenantId: "default", timezone: "UTC", updatedAt: "ts", updatedBy: "STEFAN" } }));
    await expect(new DynamoDbHouseholdRepository(c, "tenner-households").saveSettings("default", { timezone: "UTC", name: undefined }, "STEFAN", "ts")).resolves.toMatchObject({ timezone: "UTC", updatedBy: "STEFAN" });
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({
      Key: { tenantId: "default" },
      UpdateExpression: "SET #timezone = :timezone, #updatedAt = :timestamp, #updatedBy = :actor",
      ExpressionAttributeNames: { "#timezone": "timezone", "#updatedAt": "updatedAt", "#updatedBy": "updatedBy" },
    });
  });

  it("reads the household settings of HOUSEHOLD-ADMIN-003 and ignores malformed values", async () => {
    const read = (item: Record<string, unknown>) => new DynamoDbHouseholdRepository(client(async () => ({ Item: { tenantId: "default", ...item } })), "t").get("default");
    await expect(read({ name: "Familie S.", weekStartsOn: "SUNDAY", workdays: ["FRI", "MON", "XYZ"], defaults: { category: "FITNESS", estimatedMinutes: 30, frequencyDays: 7 } })).resolves.toMatchObject({
      name: "Familie S.",
      weekStartsOn: "SUNDAY",
      workdays: ["MON", "FRI"],
      defaults: { category: "FITNESS", estimatedMinutes: 30, frequencyDays: 7 },
    });
    await expect(read({ weekStartsOn: "FRIDAY", workdays: [], defaults: { category: "x" } })).resolves.toMatchObject({ weekStartsOn: null, workdays: null, defaults: null });
    await expect(read({ workdays: "MON", defaults: "x" })).resolves.toMatchObject({ workdays: null, defaults: null });
  });

  it("maps failures and empty update responses to PersistenceError", async () => {
    const failing = new DynamoDbHouseholdRepository(client(async () => Promise.reject(new Error("x"))), "t");
    await expect(failing.get("default")).rejects.toBeInstanceOf(PersistenceError);
    await expect(failing.saveSettings("default", { timezone: "UTC" }, "STEFAN", "ts")).rejects.toBeInstanceOf(PersistenceError);
    await expect(new DynamoDbHouseholdRepository(client(async () => ({})), "t").saveSettings("default", { timezone: "UTC" }, "STEFAN", "ts")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("local 'today' (SCHEDULING-008)", () => {
  // 2 Oct 2026 00:30 in Berlin = 1 Oct 22:30 UTC
  const justAfterLocalMidnight = () => new Date("2026-10-01T22:30:00Z");

  it("dashboard today boundary follows local midnight", async () => {
    const repository = mockTennerRepository();
    repository.getDashboardCandidates.mockResolvedValue([tennerFixture({ tennerId: "a", nextDue: "2026-10-02" }), tennerFixture({ tennerId: "b", nextDue: "2026-10-01" })]);
    repository.list.mockResolvedValue([]);
    const berlin = await new DashboardService(repository, justAfterLocalMidnight, async () => "Europe/Berlin", async () => null).getDashboard("default");
    expect(berlin).toMatchObject({ referenceDate: "2026-10-02", timezone: "Europe/Berlin", summary: { dueTodayCount: 1, overdueCount: 1 } });
    const utc = await new DashboardService(repository, justAfterLocalMidnight, async () => "UTC", async () => null).getDashboard("default");
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
