/** FOOD-019: food analytics on fixed plans. */

import { describe, expect, it } from "vitest";
import { computeFoodAnalytics, type DishResponse, type MealRecord } from "../src/meals/index.js";
import { catalogDishResponses, familyProfile } from "./mocks/meals.js";

const base = catalogDishResponses();
const cost = (perAdultPortion: number) => ({ perAdultPortion, pantry: 0, familyOverride: null, source: "INGREDIENTS" as const, estimated: true as const, complete: true, missingIngredients: [] });
const dish = (index: number, fields: Partial<DishResponse>): DishResponse => ({ ...(base[index] as DishResponse), archived: false, ...fields });
const PASTA = dish(0, { dishId: "pasta", name: "Pasta", proteinSources: [], isVegetarian: true, cost: cost(2) });
const CHICKEN = dish(1, { dishId: "chicken", name: "Hähnchen", proteinSources: ["POULTRY"], isVegetarian: false, cost: cost(4) });
const FISH = dish(2, { dishId: "fish", name: "Fisch", proteinSources: ["FISH"], isVegetarian: false, cost: cost(3) });
const SOUP = dish(3, { dishId: "soup", name: "Suppe", proteinSources: [], isVegetarian: true, cost: cost(1) });
const OLD = dish(4, { dishId: "old", name: "Archiviert", archived: true, cost: cost(1) });
const DISHES = [PASTA, CHICKEN, FISH, SOUP, OLD];
// Family profile: all eaters together 3.5 portions at dinner; weekday lunch: the two adults (2).
const PROFILE = familyProfile();

const meal = (date: string, slot: "LUNCH" | "DINNER", dishId: string, status: MealRecord["status"] = "COOKED", extra: Partial<MealRecord> = {}): MealRecord => ({
  slotId: `${date}#${slot}`,
  date,
  dishId,
  status,
  source: "AUTO",
  ...extra,
});

const RECORDS: MealRecord[] = [
  meal("2026-10-05", "DINNER", "pasta", "COOKED", { feedback: "UP" }), // Monday
  meal("2026-10-06", "DINNER", "chicken"),
  meal("2026-10-07", "DINNER", "pasta", "COOKED", { source: "MANUAL" }),
  meal("2026-10-08", "DINNER", "fish", "SKIPPED"),
  meal("2026-10-09", "DINNER", "chicken", "OTHER"),
  meal("2026-10-12", "LUNCH", "pasta", "PLANNED"), // two days ago: counts as cooked
  meal("2026-10-14", "DINNER", "fish", "PLANNED"), // today
  meal("2026-10-15", "DINNER", "soup", "PLANNED"), // future: not counted
  meal("2026-08-01", "DINNER", "soup"), // outside 4 weeks
];

const run = (period: "4w" | "12w" | "1y" = "4w", records = RECORDS) =>
  computeFoodAnalytics({ records, dishes: DISHES, profile: PROFILE, today: "2026-10-14", weekStartsOn: "MONDAY", period });

describe("computeFoodAnalytics", () => {
  it("counts eaten meals in the period and the protein sources", () => {
    const result = run();
    expect(result).toMatchObject({ period: "4w", from: "2026-09-17", to: "2026-10-14", meals: 5 });
    expect(result.protein).toEqual([
      { tag: "NONE", count: 3 },
      { tag: "FISH", count: 1 },
      { tag: "POULTRY", count: 1 },
    ]);
    expect(result.vegetarianShare).toBeCloseTo(3 / 5);
  });

  it("ranks favorites by count and 👍 and lists rarely eaten active dishes", () => {
    const result = run();
    expect(result.favorites.map((entry) => [entry.name, entry.count, entry.feedback])).toEqual([
      ["Pasta", 3, "UP"],
      ["Fisch", 1, null],
      ["Hähnchen", 1, null],
    ]);
    expect(result.rarelyEaten).toEqual([{ dishId: "soup", name: "Suppe" }]);
    expect(result.variety).toEqual({ distinctDishes: 3, meals: 5, repeats: [{ dishId: "pasta", name: "Pasta", count: 3 }] });
  });

  it("prices meals for their eaters and sums weeks", () => {
    const result = run();
    // Dinners: 3.5 portions; Monday lunch: 2 adults.
    expect(result.cost.weeks).toEqual([
      { weekStart: "2026-10-05", total: 2 * 3.5 + 4 * 3.5 + 2 * 3.5 },
      { weekStart: "2026-10-12", total: 2 * 2 + 3 * 3.5 },
    ]);
    expect(result.cost.total).toBe(42.5);
    expect(result.cost.perMeal).toBe(8.5);
  });

  it("shows how the plan was followed", () => {
    expect(run().adherence).toEqual({ asPlanned: 3, replaced: 1, skipped: 1, other: 1 });
  });

  it("uses longer periods and handles an empty history", () => {
    expect(run("12w").meals).toBe(6);
    expect(run("1y").from).toBe("2025-10-15");
    const empty = run("4w", []);
    expect(empty).toMatchObject({ meals: 0, vegetarianShare: null, favorites: [], cost: { total: 0, perMeal: null, weeks: [] } });
    expect(empty.rarelyEaten.map((entry) => entry.name)).toEqual(["Fisch", "Hähnchen", "Pasta", "Suppe"]);
  });
});
