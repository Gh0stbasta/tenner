/** HOUSEHOLD-ADMIN-002: household category management. */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "../src/exceptions/index.js";
import { createCategoryHandler, listCategoriesHandler, updateCategoryHandler } from "../src/handlers/categories.js";
import { SEED_CATEGORIES, type HouseholdCategory, type HouseholdSettings } from "../src/models/index.js";
import { DynamoDbHouseholdRepository } from "../src/repositories/index.js";
import { CategoryService, CreateTennerService, DashboardService, UpdateTennerService } from "../src/services/index.js";
import { householdSettings, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-05T08:00:00Z");
const TS = "2026-10-05T08:00:00Z";
const GARDEN: HouseholdCategory = { categoryId: "GARDEN", name: "Garten", icon: "GARDEN", color: "GREEN", sortOrder: 6, archived: false, createdAt: TS, updatedAt: TS };

function repository(stored?: Partial<HouseholdSettings>) {
  const settings: HouseholdSettings | undefined = stored
    ? householdSettings(stored)
    : undefined;
  return {
    get: vi.fn(async () => settings),
    saveCategories: vi.fn(async (tenantId: string, categories: readonly HouseholdCategory[], version: number) =>
      householdSettings({ tenantId, updatedAt: TS, categories, categoriesVersion: version + 1 }),
    ),
  };
}

const ids = (categories: readonly { categoryId: string }[]) => categories.map((category) => category.categoryId);

describe("CategoryService", () => {
  it("seeds the six original categories in order", async () => {
    const categories = await new CategoryService(repository(), () => NOW).listCategories("default");
    expect(ids(categories)).toEqual(["HOUSEHOLD", "FITNESS", "FAMILY", "HOME", "PERSONAL", "FINANCE"]);
    expect(categories[0]).toEqual({ categoryId: "HOUSEHOLD", name: "Haushalt", icon: "CLEANING", color: "BLUE", sortOrder: 0, archived: false });
  });

  it("creates a category at the end and stores seed + new (seed idempotent)", async () => {
    const repo = repository();
    const created = await new CategoryService(repo, () => NOW).createCategory(TEST_IDENTITY, { name: "Garten", icon: "GARDEN", color: "GREEN" });
    expect(created).toEqual({ categoryId: "GARTEN", name: "Garten", icon: "GARDEN", color: "GREEN", sortOrder: 6, archived: false });
    expect(ids(repo.saveCategories.mock.calls[0]?.[1] ?? [])).toEqual([...ids(SEED_CATEGORIES), "GARTEN"]);
    expect(repo.saveCategories.mock.calls[0]?.[2]).toBe(0);
  });

  it("rejects duplicates, underivable IDs and too many categories", async () => {
    const service = new CategoryService(repository(), () => NOW);
    await expect(service.createCategory(TEST_IDENTITY, { categoryId: "HOME", name: "Zuhause", icon: "HOME", color: "RED" })).rejects.toMatchObject({ code: "CATEGORY_EXISTS", statusCode: 409 });
    await expect(service.createCategory(TEST_IDENTITY, { name: "42", icon: "STAR", color: "RED" })).rejects.toBeInstanceOf(ValidationError);
    const many = Array.from({ length: 30 }, (_, i) => ({ ...GARDEN, categoryId: `C${i}`, sortOrder: i }));
    await expect(new CategoryService(repository({ categories: many, categoriesVersion: 1 }), () => NOW).createCategory(TEST_IDENTITY, { name: "Neu", icon: "STAR", color: "RED" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("archives, renames and reorders with renumbering", async () => {
    const repo = repository({ categories: [...SEED_CATEGORIES, GARDEN], categoriesVersion: 2 });
    const service = new CategoryService(repo, () => NOW);
    await expect(service.updateCategory(TEST_IDENTITY, "FINANCE", { archived: true, name: "Geld" })).resolves.toMatchObject({ name: "Geld", archived: true, sortOrder: 5 });
    await service.updateCategory(TEST_IDENTITY, "GARDEN", { sortOrder: 0 });
    const reordered = repo.saveCategories.mock.calls[1]?.[1] ?? [];
    expect(ids(reordered)).toEqual(["GARDEN", "HOUSEHOLD", "FITNESS", "FAMILY", "HOME", "PERSONAL", "FINANCE"]);
    expect(reordered.map((category) => category.sortOrder)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    await service.updateCategory(TEST_IDENTITY, "HOUSEHOLD", { sortOrder: 99 });
    expect(ids(repo.saveCategories.mock.calls[2]?.[1] ?? []).at(-1)).toBe("HOUSEHOLD");
    await expect(service.updateCategory(TEST_IDENTITY, "NOPE", { name: "x" })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("Tenner validation with managed categories", () => {
  const archived = [...SEED_CATEGORIES.map((c) => (c.categoryId === "FINANCE" ? { ...c, archived: true } : c)), GARDEN];
  const categoriesOf = async () => archived;
  const request = { title: "Rasen mähen", estimatedMinutes: 30, frequencyDays: 7, frequencyUnit: "DAY", frequencyInterval: 7, weekdays: null, assignedTo: "STEFAN", assignmentMode: "FIXED", rotation: null } as const;

  it("accepts new categories and rejects unknown and archived ones for new Tenners", async () => {
    const service = new CreateTennerService(mockTennerRepository(), () => NOW, () => "t-1", async () => "UTC", undefined, categoriesOf);
    await expect(service.createTenner(TEST_IDENTITY, { ...request, category: "GARDEN" })).resolves.toMatchObject({ category: "GARDEN" });
    await expect(service.createTenner(TEST_IDENTITY, { ...request, category: "PETS" })).rejects.toMatchObject({ details: [{ field: "category", message: "Unknown category." }] });
    await expect(service.createTenner(TEST_IDENTITY, { ...request, category: "FINANCE" })).rejects.toMatchObject({ details: [{ field: "category", message: "The category is archived." }] });
  });

  it("keeps an archived category on existing Tenners but rejects choosing it", async () => {
    const repo = mockTennerRepository();
    repo.update.mockResolvedValue(tennerFixture({ category: "FINANCE", title: "Neu" }));
    const service = new UpdateTennerService(repo, () => NOW, undefined, categoriesOf);
    await expect(service.updateTenner(TEST_IDENTITY, "t-1", { title: "Neu" })).resolves.toMatchObject({ category: "FINANCE" });
    await expect(service.updateTenner(TEST_IDENTITY, "t-1", { category: "FINANCE" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("groups the dashboard by any category, including new and archived ones", async () => {
    const repo = mockTennerRepository();
    repo.getDashboardCandidates.mockResolvedValue([tennerFixture({ tennerId: "a", category: "GARDEN", nextDue: "2026-10-05" }), tennerFixture({ tennerId: "b", category: "FINANCE", nextDue: "2026-10-04" })]);
    repo.list.mockResolvedValue([]);
    const dashboard = await new DashboardService(repo, () => NOW, async () => "UTC", async () => null).getDashboard("default");
    expect(dashboard.byCategory).toEqual({ GARDEN: { count: 1, estimatedMinutes: 10 }, FINANCE: { count: 1, estimatedMinutes: 10 } });
  });
});

describe("DynamoDbHouseholdRepository categories", () => {
  const client = (impl: () => Promise<unknown>) => ({ send: vi.fn<(command: unknown) => Promise<unknown>>(impl) });

  it("reads categories, dropping malformed entries and defaulting unknown icons", async () => {
    const c = client(async () => ({ Item: { tenantId: "default", categoriesVersion: 3, categories: [GARDEN, { categoryId: "bad", name: "x" }, { categoryId: "PETS", name: "Tiere", icon: "UNICORN", color: "GOLD" }] } }));
    const settings = await new DynamoDbHouseholdRepository(c, "t").get("default");
    expect(settings?.categories?.map((c) => [c.categoryId, c.icon, c.color, c.sortOrder])).toEqual([["GARDEN", "GARDEN", "GREEN", 6], ["PETS", "STAR", "GREY", 2]]);
    expect(settings?.categoriesVersion).toBe(3);
  });

  it("saves the category list with optimistic locking", async () => {
    const c = client(async () => ({ Attributes: { tenantId: "default", categories: [GARDEN], categoriesVersion: 2 } }));
    await new DynamoDbHouseholdRepository(c, "tenner-households").saveCategories("default", [GARDEN], 1, "STEFAN", TS);
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({
      ConditionExpression: "#version = :expectedVersion",
      ExpressionAttributeNames: { "#list": "categories", "#version": "categoriesVersion" },
      ExpressionAttributeValues: { ":expectedVersion": 1, ":nextVersion": 2 },
    });
  });
});

describe("category handlers", () => {
  const event = (body: unknown, categoryId?: string) => ({ body: JSON.stringify(body), isBase64Encoded: false, pathParameters: categoryId ? { categoryId } : undefined }) as unknown as APIGatewayProxyEventV2;
  const garden = { categoryId: "GARDEN", name: "Garten", icon: "GARDEN" as const, color: "GREEN" as const, sortOrder: 6, archived: false };

  it("lists, creates and updates with logging", async () => {
    expect(JSON.parse((await listCategoriesHandler("default", async () => [garden])).body ?? "").data).toEqual([garden]);
    const logger = mockLogger();
    const create = vi.fn(async () => garden);
    expect((await createCategoryHandler(event({ name: " Garten ", icon: "GARDEN", color: "GREEN" }), TEST_IDENTITY, create, logger)).statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(TEST_IDENTITY, { name: "Garten", icon: "GARDEN", color: "GREEN" });
    const update = vi.fn(async () => garden);
    await updateCategoryHandler(event({ archived: true }, "GARDEN"), TEST_IDENTITY, update, logger);
    expect(update).toHaveBeenCalledWith(TEST_IDENTITY, "GARDEN", { archived: true });
    expect(logger.info).toHaveBeenCalledWith("Category updated", { event: "CategoryUpdated", categoryId: "GARDEN", changedFields: ["archived"], updatedBy: "STEFAN" });
  });

  it.each([
    ["unknown icon", { name: "Garten", icon: "UNICORN", color: "GREEN" }],
    ["blank name", { name: " ", icon: "GARDEN", color: "GREEN" }],
    ["invalid id", { categoryId: "garden", name: "Garten", icon: "GARDEN", color: "GREEN" }],
    ["unknown field", { name: "Garten", icon: "GARDEN", color: "GREEN", archived: true }],
  ])("rejects %s on create", async (_name, body) => {
    await expect(createCategoryHandler(event(body), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects empty updates, negative positions and invalid path IDs", async () => {
    await expect(updateCategoryHandler(event({}, "GARDEN"), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
    await expect(updateCategoryHandler(event({ sortOrder: -1 }, "GARDEN"), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
    await expect(updateCategoryHandler(event({ archived: true }, "garden"), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
  });
});
