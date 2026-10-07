/** FOOD-004: family food profile, defaults, attendance and validation. */

import { describe, expect, it } from "vitest";
import { SEED_MEMBERS } from "../src/models/index.js";
import { DEFAULT_HOUSEHOLD_FOOD_RULES, eatersAt, foodProfileSchema, IngredientService, ProfileService, type Eater, type FoodProfile } from "../src/meals/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-07T10:00:00Z");

function setup() {
  const meals = inMemoryMeals();
  const ingredients = new IngredientService(meals.store, () => NOW);
  let next = 0;
  const profiles = new ProfileService({
    store: meals.store,
    ingredientsOf: (tenantId) => ingredients.ingredientsOf(tenantId),
    membersOf: async () => SEED_MEMBERS,
    clock: () => NOW,
    ids: () => `eater-${++next}`,
  });
  return { meals, profiles };
}

const request = (body: Record<string, unknown>) => validate(foodProfileSchema, { household: DEFAULT_HOUSEHOLD_FOOD_RULES, ...body });

const FAMILY = [
  { eaterId: "a1", name: "Erwachsener 1", type: "ADULT", allergies: ["NUTS", "APPLE"] },
  { eaterId: "a2", name: "Erwachsener 2", type: "ADULT", diet: "VEGETARIAN", vegetarianExceptions: ["MINCE", "SAUSAGE"] },
  { eaterId: "k1", name: "Kind 1", type: "CHILD" },
  { eaterId: "k2", name: "Kind 2", type: "CHILD", portionFactor: 0.4 },
];

describe("food profile defaults", () => {
  it("reproduce the owner's rules", () => {
    expect(DEFAULT_HOUSEHOLD_FOOD_RULES).toMatchObject({
      dislikeTags: ["TOFU", "QUINOA", "BLUE_CHEESE"],
      maxActiveMinutes: 20,
      lightLunchOnWeekdays: true,
      maxSaladLunchesPerWeek: 2,
      chicken: { maxPerWeek: 1, allowedSlots: ["MON#DINNER", "TUE#DINNER"] },
      maxBurgerPerWeek: 1,
      limitedProteinTags: ["POULTRY", "FISH", "MINCE", "BURGER_PATTY", "SAUSAGE", "MEATBALL", "HAM"],
    });
  });

  it("is returned until the profile is saved", async () => {
    const { profiles } = setup();
    await expect(profiles.getProfile("default")).resolves.toEqual({ eaters: [], household: DEFAULT_HOUSEHOLD_FOOD_RULES, updatedAt: null });
  });
});

describe("eatersAt (decision 5)", () => {
  const profile = (attendance: FoodProfile["household"]["attendance"]): FoodProfile => ({
    eaters: FAMILY.map((eater) => ({ ...eater, portionFactor: 1, diet: "OMNIVORE", vegetarianExceptions: [], allergies: [], dislikeTags: [], dislikeIngredients: [], likeIngredients: [], likeGroups: [] }) as Eater),
    household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, attendance },
    updatedAt: null,
  });
  const ids = (eaters: readonly Eater[]) => eaters.map((eater) => eater.eaterId);

  it("defaults to adults on weekday lunches and everyone else", () => {
    const defaults = profile({ weekdayLunch: null, weekendLunch: null, dinner: null });
    expect(ids(eatersAt(defaults, "MON", "LUNCH"))).toEqual(["a1", "a2"]);
    expect(ids(eatersAt(defaults, "FRI", "LUNCH"))).toEqual(["a1", "a2"]);
    expect(ids(eatersAt(defaults, "SAT", "LUNCH"))).toEqual(["a1", "a2", "k1", "k2"]);
    expect(ids(eatersAt(defaults, "WED", "DINNER"))).toEqual(["a1", "a2", "k1", "k2"]);
  });

  it("uses configured eaters", () => {
    const configured = profile({ weekdayLunch: ["a1"], weekendLunch: ["a1", "k1"], dinner: [] });
    expect(ids(eatersAt(configured, "TUE", "LUNCH"))).toEqual(["a1"]);
    expect(ids(eatersAt(configured, "SUN", "LUNCH"))).toEqual(["a1", "k1"]);
    expect(eatersAt(configured, "SUN", "DINNER")).toEqual([]);
  });
});

describe("ProfileService", () => {
  it("saves eaters with default portions and keeps them per tenant", async () => {
    const { profiles } = setup();
    const saved = await profiles.updateProfile(TEST_IDENTITY, request({ eaters: [...FAMILY, { name: " Gast ", type: "ADULT" }] }));
    expect(saved.updatedAt).toBe("2026-10-07T10:00:00Z");
    expect(saved.eaters.map((eater) => [eater.eaterId, eater.name, eater.portionFactor])).toEqual([
      ["a1", "Erwachsener 1", 1],
      ["a2", "Erwachsener 2", 1],
      ["k1", "Kind 1", 0.5],
      ["k2", "Kind 2", 0.4],
      ["eater-1", "Gast", 1],
    ]);
    expect(saved.eaters[0]).toMatchObject({ allergies: ["NUTS", "APPLE"], diet: "OMNIVORE", dislikeTags: [] });
    await expect(profiles.getProfile("default")).resolves.toEqual(saved);
    await expect(profiles.getProfile("other")).resolves.toMatchObject({ eaters: [] });
  });

  it("stores attendance and household rules", async () => {
    const { profiles } = setup();
    const household = { ...DEFAULT_HOUSEHOLD_FOOD_RULES, attendance: { weekdayLunch: ["a1", "a2"], weekendLunch: null, dinner: null }, maxActiveMinutes: 25 };
    const saved = await profiles.updateProfile(TEST_IDENTITY, request({ eaters: FAMILY, household }));
    expect(saved.household).toMatchObject({ maxActiveMinutes: 25, attendance: { weekdayLunch: ["a1", "a2"] } });
    const again = await profiles.updateProfile(TEST_IDENTITY, request({ eaters: FAMILY.slice(0, 2), household: { ...household, attendance: { ...household.attendance, weekdayLunch: ["a1"] } } }));
    expect(again.eaters).toHaveLength(2);
  });

  it("checks references: eaters, members, ingredients and attendance", async () => {
    const { profiles } = setup();
    const invalid = request({
      eaters: [
        { eaterId: "x", name: "Eins", type: "ADULT", memberId: "NOBODY", dislikeIngredients: ["unicorn"] },
        { eaterId: "x", name: "eins", type: "ADULT", vegetarianExceptions: ["MINCE"] },
      ],
      household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, dislikeIngredients: ["dragonfruit"], attendance: { weekdayLunch: ["ghost"], weekendLunch: null, dinner: null } },
    });
    const error = await profiles.updateProfile(TEST_IDENTITY, invalid).catch((caught: unknown) => caught);
    expect((error as { details: { field: string }[] }).details.map((detail) => detail.field)).toEqual([
      "eaters.0.memberId",
      "eaters.0.dislikeIngredients.0",
      "eaters.1.eaterId",
      "eaters.1.name",
      "eaters.1.vegetarianExceptions",
      "household.dislikeIngredients.0",
      "household.attendance.weekdayLunch.0",
    ]);
  });

  it("links each member to one eater only", async () => {
    const { profiles } = setup();
    const linked = request({ eaters: [{ name: "A", type: "ADULT", memberId: "STEFAN" }, { name: "B", type: "ADULT", memberId: "STEFAN" }] });
    await expect(profiles.updateProfile(TEST_IDENTITY, linked)).rejects.toMatchObject({ details: [{ field: "eaters.1.memberId" }] });
  });
});

describe("profile request validation", () => {
  it("rejects invalid values", () => {
    expect(() => request({ eaters: [{ name: "A", type: "BABY" }] })).toThrow();
    expect(() => request({ eaters: [{ name: "A", type: "ADULT", portionFactor: 3 }] })).toThrow();
    expect(() => request({ eaters: [{ name: "A", type: "ADULT", allergies: ["PEANUT"] }] })).toThrow();
    expect(() => request({ eaters: [], household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, mealTimes: { lunch: "25:00", dinner: "18:00" } } })).toThrow();
    expect(() => request({ eaters: [], household: { ...DEFAULT_HOUSEHOLD_FOOD_RULES, chicken: { maxPerWeek: 1, allowedSlots: ["MON#BREAKFAST"] } } })).toThrow();
    expect(() => validate(foodProfileSchema, { eaters: [] })).toThrow();
  });
});
