/** DATA-008: household task catalog import. */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import type { Identity } from "../src/auth/index.js";
import type { CreateMemberRequest } from "../src/dto/index.js";
import { CATALOG_MEMBERS, CATALOG_TENNERS } from "../src/catalog/household-catalog.js";
import { ConflictError, ValidationError } from "../src/exceptions/index.js";
import { importCatalogHandler } from "../src/handlers/household.js";
import { SEED_MEMBERS, type HouseholdMember, type Tenner } from "../src/models/index.js";
import { CatalogImportService, firstDueOf, toCreateRequest } from "../src/services/index.js";
import { createTennerSchema } from "../src/validators/index.js";
import { mockLogger, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-07T06:00:00Z"); // Wednesday
const TODAY = "2026-10-07";

function setup({ members = SEED_MEMBERS, tenners = [] as Tenner[] }: { members?: readonly HouseholdMember[]; tenners?: Tenner[] } = {}) {
  const deps = {
    membersOf: vi.fn(async () => members),
    createMember: vi.fn(async (_identity: Identity, request: CreateMemberRequest) => ({ userId: request.userId ?? "X", displayName: request.displayName, color: "TEAL" as const, active: true, canSignIn: false })),
    tenners: { list: vi.fn(async () => tenners) },
    createTenner: vi.fn(async () => ({}) as never),
    timezoneOf: async () => "Europe/Berlin",
    clock: () => NOW,
  };
  return { deps, service: new CatalogImportService(deps) };
}

describe("household catalog (DATA-008)", () => {
  it("has 34 valid Tenners with unique titles and known assignees", () => {
    expect(CATALOG_TENNERS).toHaveLength(34);
    expect(new Set(CATALOG_TENNERS.map((entry) => entry.title.toLowerCase())).size).toBe(34);
    const assignees = new Set([...SEED_MEMBERS, ...CATALOG_MEMBERS].map((member) => member.userId));
    for (const entry of CATALOG_TENNERS) {
      expect(assignees.has(entry.assignedTo)).toBe(true);
      const request = toCreateRequest(entry);
      expect(createTennerSchema.safeParse({ title: request.title, category: request.category, estimatedMinutes: request.estimatedMinutes, frequencyUnit: request.frequencyUnit, frequencyInterval: request.frequencyInterval, ...(request.weekdays ? { weekdays: request.weekdays } : {}), assignedTo: request.assignedTo }).success).toBe(true);
    }
    expect(CATALOG_MEMBERS).toEqual([{ userId: "HAUSHALTSHILFE", displayName: "Haushaltshilfe", color: "TEAL", canSignIn: false }]);
  });

  it("puts the rotations on Fridays every 12 weeks and Saturdays every 26 weeks, one per week", () => {
    const fridays = CATALOG_TENNERS.filter((entry) => entry.weekdays?.[0] === "FRI");
    expect(fridays).toHaveLength(12);
    expect(fridays.every((entry) => entry.frequencyInterval === 12)).toBe(true);
    expect(fridays.map((entry) => entry.slot)).toEqual([...Array(12).keys()]);
    const saturdays = CATALOG_TENNERS.filter((entry) => entry.weekdays?.[0] === "SAT");
    expect(saturdays).toHaveLength(10);
    expect(saturdays.every((entry) => entry.frequencyInterval === 26)).toBe(true);
  });

  it("computes the first due date from weekday and slot", () => {
    expect(firstDueOf({ weekdays: null, slot: 0 }, TODAY)).toBe(TODAY);
    expect(firstDueOf({ weekdays: ["WED"], slot: 0 }, TODAY)).toBe(TODAY);
    expect(firstDueOf({ weekdays: ["MON"], slot: 0 }, TODAY)).toBe("2026-10-12");
    expect(firstDueOf({ weekdays: ["FRI"], slot: 0 }, TODAY)).toBe("2026-10-09");
    expect(firstDueOf({ weekdays: ["FRI"], slot: 11 }, TODAY)).toBe("2026-12-25");
  });
});

describe("CatalogImportService (DATA-008)", () => {
  it("dry run reports everything without writing", async () => {
    const { deps, service } = setup();
    const result = await service.importCatalog(TEST_IDENTITY, true);
    expect(result).toMatchObject({ dryRun: true, membersCreated: ["Haushaltshilfe"], tennersSkipped: [] });
    expect(result.tennersCreated).toHaveLength(34);
    expect(deps.createMember).not.toHaveBeenCalled();
    expect(deps.createTenner).not.toHaveBeenCalled();
  });

  it("creates the member without login first, then the Tenners with their first due dates", async () => {
    const { deps, service } = setup();
    await service.importCatalog(TEST_IDENTITY, false);
    expect(deps.createMember).toHaveBeenCalledWith(TEST_IDENTITY, CATALOG_MEMBERS[0]);
    expect(deps.createTenner).toHaveBeenCalledTimes(34);
    expect(deps.createTenner).toHaveBeenCalledWith(TEST_IDENTITY, expect.objectContaining({ title: "Kleines Bad", weekdays: ["MON"], assignedTo: "STEFAN" }), "2026-10-12");
    expect(deps.createTenner).toHaveBeenCalledWith(TEST_IDENTITY, expect.objectContaining({ title: "Haushalt-Wartung prüfen", frequencyUnit: "WEEK", frequencyInterval: 12 }), "2026-12-25");
    expect(deps.createTenner).toHaveBeenCalledWith(TEST_IDENTITY, expect.objectContaining({ title: "Böden gründlich reinigen", assignedTo: "HAUSHALTSHILFE" }), TODAY);
    expect(deps.tenners.list).toHaveBeenCalledWith("default", { includeDeleted: true });
  });

  it("is idempotent: existing members and titles (also archived, any case) are skipped", async () => {
    const help: HouseholdMember = { userId: "HAUSHALTSHILFE", displayName: "Haushaltshilfe", color: "TEAL", active: true, canSignIn: false, createdAt: "t", updatedAt: "t" };
    const { deps, service } = setup({
      members: [...SEED_MEMBERS, help],
      tenners: [tennerFixture({ title: " kleines bad " }), tennerFixture({ tennerId: "x", title: "Fenster Teil 1", deletedAt: "2026-10-01T00:00:00Z" })],
    });
    const result = await service.importCatalog(TEST_IDENTITY, false);
    expect(result.membersCreated).toEqual([]);
    expect(result.tennersSkipped).toEqual(["Kleines Bad", "Fenster Teil 1"]);
    expect(deps.createMember).not.toHaveBeenCalled();
    expect(deps.createTenner).toHaveBeenCalledTimes(32);
  });

  it("refuses when the household lacks Stefan or Julia", async () => {
    const { deps, service } = setup({ members: [SEED_MEMBERS[0] as HouseholdMember] });
    const error = await service.importCatalog(TEST_IDENTITY, false).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: "CATALOG_MEMBERS_MISSING", message: expect.stringContaining("JULIA") });
    expect(deps.createTenner).not.toHaveBeenCalled();
  });
});

describe("importCatalogHandler (DATA-008)", () => {
  const event = (body?: string) => ({ body, isBase64Encoded: false }) as unknown as APIGatewayProxyEventV2;
  const result = { dryRun: false, membersCreated: ["Haushaltshilfe"], tennersCreated: ["A", "B"], tennersSkipped: ["C"] };

  it("imports with an empty body and logs the counts", async () => {
    const logger = mockLogger();
    const importCatalog = vi.fn(async () => result);
    const response = await importCatalogHandler(event(), TEST_IDENTITY, importCatalog, logger);
    expect(response.statusCode).toBe(200);
    expect(importCatalog).toHaveBeenCalledWith(TEST_IDENTITY, false);
    expect(logger.info).toHaveBeenCalledWith("Household catalog imported", { event: "HouseholdCatalogImported", importedBy: "STEFAN", membersCreated: 1, tennersCreated: 2, tennersSkipped: 1 });
  });

  it("passes a dry run without logging an import and rejects unknown fields", async () => {
    const logger = mockLogger();
    const importCatalog = vi.fn(async () => ({ ...result, dryRun: true }));
    await importCatalogHandler(event(JSON.stringify({ dryRun: true })), TEST_IDENTITY, importCatalog, logger);
    expect(importCatalog).toHaveBeenCalledWith(TEST_IDENTITY, true);
    expect(logger.info).not.toHaveBeenCalled();
    await expect(importCatalogHandler(event(JSON.stringify({ wipe: true })), TEST_IDENTITY, importCatalog, logger)).rejects.toBeInstanceOf(ValidationError);
  });
});
