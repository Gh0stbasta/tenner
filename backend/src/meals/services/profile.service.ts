/** Family food profile (FOOD-004): one versioned PROFILE item per household; defaults until the first save. */

import type { Identity } from "../../auth/index.js";
import { ValidationError, type ErrorDetail } from "../../exceptions/index.js";
import type { HouseholdMember } from "../../models/index.js";
import { toUtcTimestamp, type Clock, type IdGenerator } from "../../utils/clock.js";
import { itemKey } from "../keys.js";
import type { ResolvedIngredient } from "../models/ingredient.js";
import { DEFAULT_HOUSEHOLD_FOOD_RULES, DEFAULT_PORTION_FACTOR, EMPTY_FOOD_PROFILE, type Eater, type FoodProfile, type HouseholdFoodRules } from "../models/profile.js";
import type { MealItem, MealsStore } from "../repositories/meals-store.js";
import type { FoodProfileRequest } from "../validators.js";

export interface ProfileServiceDependencies {
  readonly store: MealsStore;
  readonly ingredientsOf: (tenantId: string) => Promise<ReadonlyMap<string, ResolvedIngredient>>;
  readonly membersOf: (tenantId: string) => Promise<readonly HouseholdMember[]>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Stored profile with defaults for fields added later; the store holds only values written by this service. */
function toProfile(item: MealItem | undefined): FoodProfile {
  if (!item) return EMPTY_FOOD_PROFILE;
  const data = item.data as Partial<{ eaters: Eater[]; household: Partial<HouseholdFoodRules>; updatedAt: string }>;
  return {
    eaters: data.eaters ?? [],
    household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, ...(data.household ?? {}) },
    updatedAt: data.updatedAt ?? null,
  };
}

export class ProfileService {
  constructor(private readonly deps: ProfileServiceDependencies) {}

  async getProfile(tenantId: string): Promise<FoodProfile> {
    return toProfile(await this.deps.store.get(tenantId, itemKey("PROFILE")));
  }

  /** Replace the profile. Eaters without an ID get one; references are checked against eaters, members and ingredients. */
  async updateProfile(identity: Identity, request: FoodProfileRequest): Promise<FoodProfile> {
    const eaters: Eater[] = request.eaters.map(({ memberId, ...eater }) => ({
      ...eater,
      ...(memberId === undefined ? {} : { memberId }),
      eaterId: eater.eaterId ?? this.deps.ids(),
      name: eater.name.trim(),
      portionFactor: eater.portionFactor ?? DEFAULT_PORTION_FACTOR[eater.type],
    }));
    const household: HouseholdFoodRules = request.household;
    const [ingredients, members] = await Promise.all([this.deps.ingredientsOf(identity.tenantId), this.deps.membersOf(identity.tenantId)]);
    const errors = [...eaterErrors(eaters, members, ingredients), ...householdErrors(household, eaters, ingredients)];
    if (errors.length > 0) throw new ValidationError("Validation failed.", errors);
    const key = itemKey("PROFILE");
    const stored = await this.deps.store.get(identity.tenantId, key);
    const updatedAt = toUtcTimestamp(this.deps.clock());
    const item = await this.deps.store.put(identity.tenantId, key, { eaters, household, updatedAt, updatedBy: identity.userId }, stored?.version);
    return toProfile(item);
  }
}

function eaterErrors(eaters: readonly Eater[], members: readonly HouseholdMember[], ingredients: ReadonlyMap<string, ResolvedIngredient>): ErrorDetail[] {
  const errors: ErrorDetail[] = [];
  const memberIds = new Set(members.map((member) => member.userId));
  const seen = { ids: new Set<string>(), names: new Set<string>(), members: new Set<string>() };
  eaters.forEach((eater, index) => {
    const field = (name: string): string => `eaters.${index}.${name}`;
    if (seen.ids.has(eater.eaterId)) errors.push({ field: field("eaterId"), message: "Eater IDs must be unique." });
    seen.ids.add(eater.eaterId);
    const nameKey = eater.name.toLocaleLowerCase("de");
    if (seen.names.has(nameKey)) errors.push({ field: field("name"), message: "Names must be unique." });
    seen.names.add(nameKey);
    if (eater.memberId !== undefined) {
      if (!memberIds.has(eater.memberId)) errors.push({ field: field("memberId"), message: "Unknown household member." });
      if (seen.members.has(eater.memberId)) errors.push({ field: field("memberId"), message: "A member can be linked to one eater only." });
      seen.members.add(eater.memberId);
    }
    if (eater.diet !== "VEGETARIAN" && eater.vegetarianExceptions.length > 0) errors.push({ field: field("vegetarianExceptions"), message: "Only vegetarians have exceptions." });
    for (const name of ["dislikeIngredients", "likeIngredients"] as const) {
      eater[name].forEach((id, position) => {
        if (!ingredients.has(id)) errors.push({ field: field(`${name}.${position}`), message: "Unknown ingredient." });
      });
    }
  });
  return errors;
}

function householdErrors(household: HouseholdFoodRules, eaters: readonly Eater[], ingredients: ReadonlyMap<string, ResolvedIngredient>): ErrorDetail[] {
  const errors: ErrorDetail[] = [];
  household.dislikeIngredients.forEach((id, position) => {
    if (!ingredients.has(id)) errors.push({ field: `household.dislikeIngredients.${position}`, message: "Unknown ingredient." });
  });
  const eaterIds = new Set(eaters.map((eater) => eater.eaterId));
  for (const meal of ["weekdayLunch", "weekendLunch", "dinner"] as const) {
    household.attendance[meal]?.forEach((id, position) => {
      if (!eaterIds.has(id)) errors.push({ field: `household.attendance.${meal}.${position}`, message: "Unknown eater." });
    });
  }
  return errors;
}
