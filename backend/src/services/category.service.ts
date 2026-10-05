/** Household category management (HOUSEHOLD-ADMIN-002). Categories live in the household item of tenner-households. */

import type { Identity } from "../auth/index.js";
import type { CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest } from "../dto/index.js";
import { ConflictError, NotFoundError, ValidationError } from "../exceptions/index.js";
import { CATEGORY_ID_PATTERN, SEED_CATEGORIES, type Category, type HouseholdCategory } from "../models/index.js";
import type { HouseholdRepository } from "../repositories/index.js";
import { toUtcTimestamp, type Clock } from "../utils/clock.js";
import { slugify } from "./member.service.js";

/** Upper bound that keeps the household item small. */
export const MAX_CATEGORIES = 30;

/** The household's categories (stored list or seed), including archived ones. */
export type CategorySource = (tenantId: string) => Promise<readonly HouseholdCategory[]>;

export class CategoryService {
  constructor(
    private readonly repository: Pick<HouseholdRepository, "get" | "saveCategories">,
    private readonly clock: Clock,
  ) {}

  async categoriesOf(tenantId: string): Promise<readonly HouseholdCategory[]> {
    return (await this.load(tenantId)).categories;
  }

  /** All categories in display order (archived included, flagged). */
  async listCategories(tenantId: string): Promise<CategoryResponse[]> {
    return (await this.categoriesOf(tenantId)).map(toCategoryResponse);
  }

  /** Add a category at the end; categoryId defaults to a slug of the name and must be unique (409 CATEGORY_EXISTS). */
  async createCategory(identity: Identity, request: CreateCategoryRequest): Promise<CategoryResponse> {
    const { categories, version } = await this.load(identity.tenantId);
    const categoryId = request.categoryId ?? slugify(request.name);
    if (!CATEGORY_ID_PATTERN.test(categoryId)) {
      throw new ValidationError("Invalid category.", [{ field: "categoryId", message: "Cannot derive an ID from the name; provide categoryId (A-Z, 0-9, _)." }]);
    }
    if (categories.some((category) => category.categoryId === categoryId)) throw new ConflictError(`Category ${categoryId} already exists.`, "CATEGORY_EXISTS");
    if (categories.length >= MAX_CATEGORIES) {
      throw new ValidationError("Invalid category.", [{ field: "(root)", message: `A household can have at most ${MAX_CATEGORIES} categories.` }]);
    }
    const timestamp = toUtcTimestamp(this.clock());
    const category: HouseholdCategory = {
      categoryId,
      name: request.name,
      icon: request.icon,
      color: request.color,
      sortOrder: categories.length,
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repository.saveCategories(identity.tenantId, [...categories, category], version, identity.userId, timestamp);
    return toCategoryResponse(category);
  }

  /**
   * Rename, change icon/color, archive/unarchive or move a category. `sortOrder` is the new 0-based position;
   * all categories are renumbered. Unknown category → 404.
   */
  async updateCategory(identity: Identity, categoryId: Category, request: UpdateCategoryRequest): Promise<CategoryResponse> {
    const { categories, version } = await this.load(identity.tenantId);
    const current = categories.find((category) => category.categoryId === categoryId);
    if (!current) throw new NotFoundError("Category not found.");
    const timestamp = toUtcTimestamp(this.clock());
    const changed: HouseholdCategory = {
      ...current,
      name: request.name ?? current.name,
      icon: request.icon ?? current.icon,
      color: request.color ?? current.color,
      archived: request.archived ?? current.archived,
      updatedAt: timestamp,
    };
    const others = categories.filter((category) => category.categoryId !== categoryId);
    const position = Math.min(request.sortOrder ?? categories.indexOf(current), others.length);
    const ordered = [...others.slice(0, position), changed, ...others.slice(position)].map((category, index) => ({ ...category, sortOrder: index }));
    await this.repository.saveCategories(identity.tenantId, ordered, version, identity.userId, timestamp);
    return toCategoryResponse(ordered[position] ?? changed);
  }

  private async load(tenantId: string): Promise<{ categories: readonly HouseholdCategory[]; version: number }> {
    const settings = await this.repository.get(tenantId);
    const categories = [...(settings?.categories ?? SEED_CATEGORIES)].sort((a, b) => a.sortOrder - b.sortOrder);
    return { categories, version: settings?.categoriesVersion ?? 0 };
  }
}

export function toCategoryResponse(category: HouseholdCategory): CategoryResponse {
  const { categoryId, name, icon, color, sortOrder, archived } = category;
  return { categoryId, name, icon, color, sortOrder, archived };
}

/** 400 unless `categoryId` is a household category that is not archived (new or changed Tenner category). */
export function requireSelectableCategory(categories: readonly HouseholdCategory[], categoryId: Category): void {
  const category = categories.find((candidate) => candidate.categoryId === categoryId);
  if (!category) throw new ValidationError("Invalid request.", [{ field: "category", message: "Unknown category." }]);
  if (category.archived) throw new ValidationError("Invalid request.", [{ field: "category", message: "The category is archived." }]);
}
