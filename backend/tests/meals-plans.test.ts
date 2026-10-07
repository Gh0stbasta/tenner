/** FOOD-006: weekly plans — creation on read, readiness, week range, notifier pre-creation. */

import { describe, expect, it } from "vitest";
import { createMealServices, DEFAULT_HOUSEHOLD_FOOD_RULES, foodProfileSchema } from "../src/meals/index.js";
import type { WeekStart } from "../src/models/enums.js";
import { SEED_MEMBERS } from "../src/models/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

/** Wednesday 2026-10-14, 10:00 in Berlin. */
const NOW = new Date("2026-10-14T08:00:00Z");

function setup(weekStartsOn: WeekStart = "MONDAY") {
  const meals = inMemoryMeals();
  let next = 0;
  const services = createMealServices({
    client: meals.sender,
    tableName: "tenner-meals",
    membersOf: async () => SEED_MEMBERS,
    settingsOf: async () => ({ timezone: "Europe/Berlin", weekStartsOn }),
    clock: () => NOW,
    ids: () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
  });
  return { meals, services };
}

async function ready(services: ReturnType<typeof setup>["services"]) {
  await services.catalog.importCatalog(TEST_IDENTITY, false);
  await services.profiles.updateProfile(
    TEST_IDENTITY,
    validate(foodProfileSchema, {
      eaters: [
        { eaterId: "a1", name: "Erwachsener 1", type: "ADULT", allergies: ["NUTS", "APPLE"] },
        { eaterId: "a2", name: "Erwachsener 2", type: "ADULT", diet: "VEGETARIAN", vegetarianExceptions: ["MINCE", "SAUSAGE"] },
        { eaterId: "k1", name: "Kind 1", type: "CHILD" },
      ],
      household: DEFAULT_HOUSEHOLD_FOOD_RULES,
    }),
  );
}

describe("MealPlanService", () => {
  it("plans nothing while dishes or eaters are missing", async () => {
    const { services, meals } = setup();
    const empty = await services.plans.getPlan("default", "current");
    expect(empty).toMatchObject({ weekStart: "2026-10-12", weekEnd: "2026-10-18", ready: false, setup: { hasDishes: false, hasEaters: false }, generatedAt: null, violations: [] });
    expect(empty.slots).toHaveLength(14);
    await services.catalog.importCatalog(TEST_IDENTITY, false);
    expect(await services.plans.getPlan("default", "current")).toMatchObject({ ready: false, setup: { hasDishes: true, hasEaters: false } });
    expect([...meals.items.keys()].some((key) => key.includes("PLAN#"))).toBe(false);
  });

  it("creates the current week's plan once, with dish summaries and no hard violation", async () => {
    const { services, meals } = setup();
    await ready(services);
    const first = await services.plans.getPlan("default", "current");
    expect(first).toMatchObject({ ready: true, generatedAt: "2026-10-14T08:00:00Z", setup: { hasDishes: true, hasEaters: true } });
    expect(first.slots.every((slot) => slot.dish !== null && slot.source === "AUTO" && slot.status === "PLANNED" && !slot.locked)).toBe(true);
    expect(first.slots[0]).toMatchObject({ slotId: "2026-10-12#LUNCH", date: "2026-10-12", weekday: "MON", slot: "LUNCH" });
    expect(first.violations.filter((violation) => violation.severity === "HARD")).toEqual([]);
    const again = await services.plans.getPlan("default", "2026-10-12");
    expect(again.slots.map((slot) => slot.dishId)).toEqual(first.slots.map((slot) => slot.dishId));
    const stored = meals.items.get("default|PLAN#2026-10-12");
    expect(stored).toMatchObject({ weekStart: "2026-10-12", version: 1 });
    expect(stored?.expiresAt).toBe(Date.parse("2027-11-16T00:00:00Z") / 1000);
  });

  it("creates one plan for parallel first reads", async () => {
    const { services } = setup();
    await ready(services);
    const [a, b] = await Promise.all([services.plans.getPlan("default", "current"), services.plans.getPlan("default", "current")]);
    expect(a.slots.map((slot) => slot.dishId)).toEqual(b.slots.map((slot) => slot.dishId));
  });

  it("plans the next week but not further, and not the past", async () => {
    const { services } = setup();
    await ready(services);
    await expect(services.plans.getPlan("default", "next")).resolves.toMatchObject({ weekStart: "2026-10-19", ready: true });
    await expect(services.plans.getPlan("default", "2026-10-26")).rejects.toMatchObject({ code: "WEEK_OUT_OF_RANGE" });
    await expect(services.plans.getPlan("default", "2026-10-05")).rejects.toMatchObject({ statusCode: 404 });
    await expect(services.plans.getPlan("default", "2026-10-13")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("follows a Sunday week start", async () => {
    const { services } = setup("SUNDAY");
    await ready(services);
    await expect(services.plans.getPlan("default", "current")).resolves.toMatchObject({ weekStart: "2026-10-11", weekEnd: "2026-10-17" });
  });

  it("keeps showing archived dishes of a plan", async () => {
    const { services } = setup();
    await ready(services);
    const plan = await services.plans.getPlan("default", "current");
    const first = plan.slots[0];
    if (!first?.dishId) throw new Error("no dish");
    await services.dishes.archiveDish(TEST_IDENTITY, first.dishId);
    const after = await services.plans.getPlan("default", "current");
    expect(after.slots[0]?.dish).toMatchObject({ dishId: first.dishId, archived: true });
  });

  it("prepares the current and next week for the notifier, idempotently", async () => {
    const { services } = setup();
    expect(await services.plans.ensurePlans("default")).toBe(0);
    await ready(services);
    expect(await services.plans.ensurePlans("default")).toBe(2);
    expect(await services.plans.ensurePlans("default")).toBe(0);
  });
});
