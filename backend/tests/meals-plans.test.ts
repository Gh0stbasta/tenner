/** FOOD-006, 007, 008, 022: weekly plans — creation on read, readiness, week range, notifier pre-creation, changes by hand. */

import { describe, expect, it } from "vitest";
import { createDishSchema, createMealServices, DEFAULT_HOUSEHOLD_FOOD_RULES, foodProfileSchema, isKept, type StoredPlanSlot } from "../src/meals/index.js";
import type { WeekStart } from "../src/models/enums.js";
import { SEED_MEMBERS } from "../src/models/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

/** Wednesday 2026-10-14, 10:00 in Berlin. */
const NOW = new Date("2026-10-14T08:00:00Z");

function setup(weekStartsOn: WeekStart = "MONDAY", now: Date = NOW) {
  const meals = inMemoryMeals();
  let next = 0;
  const services = createMealServices({
    client: meals.sender,
    tableName: "tenner-meals",
    membersOf: async () => SEED_MEMBERS,
    settingsOf: async () => ({ timezone: "Europe/Berlin", weekStartsOn }),
    clock: () => now,
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

describe("replaceMeal (FOOD-007)", () => {
  async function planned() {
    const context = setup();
    await ready(context.services);
    const plan = await context.services.plans.getPlan("default", "current");
    return { ...context, plan };
  }

  it("replaces one meal with another dish that keeps the hard rules, leaving the rest", async () => {
    const { services, plan } = await planned();
    const target = plan.slots.find((slot) => slot.slotId === "2026-10-14#DINNER");
    const replaced = await services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-14#DINNER", {});
    const after = replaced.slots.find((slot) => slot.slotId === "2026-10-14#DINNER");
    expect(after?.dishId).not.toBe(target?.dishId);
    expect(after).toMatchObject({ source: "AUTO", locked: false, status: "PLANNED" });
    expect(replaced.violations.filter((violation) => violation.severity === "HARD")).toEqual([]);
    expect(replaced.slots.filter((slot) => slot.slotId !== "2026-10-14#DINNER").map((slot) => slot.dishId)).toEqual(plan.slots.filter((slot) => slot.slotId !== "2026-10-14#DINNER").map((slot) => slot.dishId));
  });

  it("cycles through alternatives with excluded dishes and never returns the current dish or its group", async () => {
    const { services, plan } = await planned();
    const current = plan.slots.find((slot) => slot.slotId === "2026-10-15#DINNER")?.dishId as string;
    const first = await services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-15#DINNER", {});
    const firstId = first.slots.find((slot) => slot.slotId === "2026-10-15#DINNER")?.dishId as string;
    const second = await services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-15#DINNER", { excludeDishIds: [current] });
    const secondId = second.slots.find((slot) => slot.slotId === "2026-10-15#DINNER")?.dishId;
    expect(new Set([current, firstId, secondId]).size).toBe(3);
  });

  it("puts a dish back (undo) and refuses a dish that breaks a hard rule", async () => {
    const { services, plan } = await planned();
    const original = plan.slots.find((slot) => slot.slotId === "2026-10-14#DINNER")?.dishId as string;
    await services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-14#DINNER", {});
    const undone = await services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-14#DINNER", { dishId: original });
    expect(undone.slots.find((slot) => slot.slotId === "2026-10-14#DINNER")?.dishId).toBe(original);
    const lasagne = (await services.dishes.listDishes("default")).find((dish) => dish.name === "Lasagne");
    await expect(services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-15#LUNCH", { dishId: lasagne?.dishId as string })).rejects.toMatchObject({ code: "RULE_VIOLATION" });
    await expect(services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-15#LUNCH", { dishId: "unknown" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("answers NO_ALTERNATIVE when nothing else fits", async () => {
    const { services, plan } = await planned();
    const others = (await services.dishes.listDishes("default")).map((dish) => dish.dishId);
    await expect(services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-14#LUNCH", { excludeDishIds: others })).rejects.toMatchObject({
      code: "NO_ALTERNATIVE",
      statusCode: 409,
    });
    expect(plan.ready).toBe(true);
  });

  it("refuses past meals, unknown meals and weeks without a plan", async () => {
    const { services } = await planned();
    await expect(services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-13#DINNER", {})).rejects.toMatchObject({ code: "MEAL_IN_PAST" });
    await expect(services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-20#DINNER", {})).rejects.toMatchObject({ statusCode: 404 });
    await expect(services.plans.replaceMeal(TEST_IDENTITY, "next", "2026-10-20#DINNER", {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it("reports parallel changes as 409", async () => {
    const { services, meals } = await planned();
    const original = meals.sender.send.bind(meals.sender);
    let bumped = false;
    meals.sender.send = async (command) => {
      if (!bumped && command.constructor.name === "PutCommand") {
        bumped = true;
        const stored = meals.items.get("default|PLAN#2026-10-12");
        if (stored) meals.items.set("default|PLAN#2026-10-12", { ...stored, version: Number(stored.version) + 1 });
      }
      return original(command);
    };
    await expect(services.plans.replaceMeal(TEST_IDENTITY, "current", "2026-10-14#DINNER", {})).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  });
});

describe("choose, lock and swap meals (FOOD-022)", () => {
  async function planned() {
    const context = setup();
    await ready(context.services);
    const plan = await context.services.plans.getPlan("default", "current");
    const dishes = await context.services.dishes.listDishes("default");
    const named = (name: string) => dishes.find((dish) => dish.name === name)?.dishId as string;
    return { ...context, plan, named };
  }

  const slotOf = (plan: { slots: readonly { slotId: string; dishId: string | null }[] }, slotId: string) => plan.slots.find((slot) => slot.slotId === slotId);

  async function appleDish(services: ReturnType<typeof setup>["services"]) {
    const dish = await services.dishes.createDish(
      TEST_IDENTITY,
      validate(createDishSchema, {
        name: "Apfelpfannkuchen",
        category: "SWEET",
        slots: ["DINNER"],
        lightness: "FILLING",
        temperature: "WARM",
        activeMinutes: 15,
        ingredients: [{ ingredientId: "apple", quantity: 100, unit: "g" }],
      }),
    );
    return dish.dishId;
  }

  it("chooses any dish by hand: manual and locked, rule conflicts returned as warnings", async () => {
    const { services, named } = await planned();
    const chosen = await services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-15#LUNCH", { dishId: named("Lasagne") });
    expect(slotOf(chosen, "2026-10-15#LUNCH")).toMatchObject({ dishId: named("Lasagne"), source: "MANUAL", locked: true, status: "PLANNED" });
    expect(chosen.violations.some((violation) => violation.severity === "HARD" && violation.slotIds.includes("2026-10-15#LUNCH"))).toBe(true);
  });

  it("needs a confirmation for allergy conflicts and saves them with a warning", async () => {
    const { services } = await planned();
    const apple = await appleDish(services);
    await expect(services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-16#DINNER", { dishId: apple })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
      statusCode: 409,
      details: [expect.objectContaining({ field: "R1" })],
    });
    const confirmed = await services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-16#DINNER", { dishId: apple, confirm: true });
    expect(slotOf(confirmed, "2026-10-16#DINNER")?.dishId).toBe(apple);
    expect(confirmed.violations.some((violation) => violation.rule === "R1")).toBe(true);
  });

  it("locks and unlocks a meal without changing its dish", async () => {
    const { services, plan } = await planned();
    const dishId = slotOf(plan, "2026-10-17#DINNER")?.dishId;
    const locked = await services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-17#DINNER", { locked: true });
    expect(slotOf(locked, "2026-10-17#DINNER")).toMatchObject({ dishId, locked: true, source: "AUTO" });
    const unlocked = await services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-17#DINNER", { locked: false });
    expect(slotOf(unlocked, "2026-10-17#DINNER")).toMatchObject({ dishId, locked: false });
  });

  it("refuses archived or unknown dishes and past meals", async () => {
    const { services, named } = await planned();
    await services.dishes.archiveDish(TEST_IDENTITY, named("Lasagne"));
    await expect(services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-15#DINNER", { dishId: named("Lasagne") })).rejects.toMatchObject({ statusCode: 404 });
    await expect(services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-15#DINNER", { dishId: "unknown" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-13#DINNER", { locked: true })).rejects.toMatchObject({ code: "MEAL_IN_PAST" });
  });

  it("swaps two meals, both manual and locked", async () => {
    const { services, plan } = await planned();
    const tuesday = slotOf(plan, "2026-10-14#DINNER")?.dishId;
    const thursday = slotOf(plan, "2026-10-16#DINNER")?.dishId;
    const swapped = await services.plans.swapMeals(TEST_IDENTITY, "current", { from: "2026-10-14#DINNER", to: "2026-10-16#DINNER", confirm: true });
    expect(slotOf(swapped, "2026-10-14#DINNER")).toMatchObject({ dishId: thursday, source: "MANUAL", locked: true });
    expect(slotOf(swapped, "2026-10-16#DINNER")).toMatchObject({ dishId: tuesday, source: "MANUAL", locked: true });
    await expect(services.plans.swapMeals(TEST_IDENTITY, "current", { from: "2026-10-14#DINNER", to: "2026-10-14#DINNER" })).rejects.toMatchObject({ statusCode: 400 });
    await expect(services.plans.swapMeals(TEST_IDENTITY, "current", { from: "2026-10-13#DINNER", to: "2026-10-14#DINNER" })).rejects.toMatchObject({ code: "MEAL_IN_PAST" });
  });

  it("needs a confirmation when a swap moves an allergy conflict to a meal with the affected eater", async () => {
    const { services } = await planned();
    const apple = await appleDish(services);
    await services.profiles.updateProfile(
      TEST_IDENTITY,
      validate(foodProfileSchema, {
        eaters: [
          { eaterId: "a1", name: "Erwachsener 1", type: "ADULT" },
          { eaterId: "k1", name: "Kind 1", type: "CHILD", allergies: ["APPLE"] },
        ],
        household: DEFAULT_HOUSEHOLD_FOOD_RULES,
      }),
    );
    // Weekday lunch is adults only, so the apple dish is harmless on Thursday lunch but not on Saturday dinner.
    await services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-15#LUNCH", { dishId: apple, confirm: true });
    await expect(services.plans.swapMeals(TEST_IDENTITY, "current", { from: "2026-10-15#LUNCH", to: "2026-10-17#DINNER" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    const swapped = await services.plans.swapMeals(TEST_IDENTITY, "current", { from: "2026-10-15#LUNCH", to: "2026-10-17#DINNER", confirm: true });
    expect(slotOf(swapped, "2026-10-17#DINNER")?.dishId).toBe(apple);
  });

  it("offers every active dish, those that fit all rules first", async () => {
    const { services } = await planned();
    const apple = await appleDish(services);
    const options = await services.plans.mealOptions("default", "current", "2026-10-16#DINNER");
    expect(options).toHaveLength((await services.dishes.listDishes("default")).length);
    const hard = options.map((option) => option.violations.filter((violation) => violation.severity === "HARD").length);
    expect(hard).toEqual([...hard].sort((a, b) => a - b));
    expect(options[0]?.violations).toEqual([]);
    expect(options.find((option) => option.dish.dishId === apple)?.violations.some((violation) => violation.rule === "R1")).toBe(true);
    await expect(services.plans.mealOptions("default", "current", "2026-10-13#DINNER")).rejects.toMatchObject({ code: "MEAL_IN_PAST" });
  });
});

describe("regenerateWeek (FOOD-008)", () => {
  async function planned() {
    const context = setup();
    await ready(context.services);
    await context.services.plans.getPlan("default", "current");
    const [fitting] = await context.services.plans.mealOptions("default", "current", "2026-10-15#LUNCH");
    await context.services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-15#LUNCH", { dishId: fitting?.dish.dishId as string });
    const plan = await context.services.plans.chooseMeal(TEST_IDENTITY, "current", "2026-10-16#DINNER", { locked: true });
    return { ...context, plan };
  }
  const KEPT = ["2026-10-12#LUNCH", "2026-10-12#DINNER", "2026-10-13#LUNCH", "2026-10-13#DINNER", "2026-10-15#LUNCH", "2026-10-16#DINNER"];
  const dishesOf = (plan: { slots: readonly { slotId: string; dishId: string | null }[] }, slotIds: readonly string[]) =>
    slotIds.map((slotId) => plan.slots.find((slot) => slot.slotId === slotId)?.dishId);
  const storedSeed = (meals: ReturnType<typeof setup>["meals"]) => meals.items.get("default|PLAN#2026-10-12")?.seed;

  it("replans the other meals with a new seed, keeping locked, manual and past meals; rules hold across both", async () => {
    const { services, meals, plan } = await planned();
    const seed = storedSeed(meals);
    const replanned = await services.plans.regenerateWeek(TEST_IDENTITY, "current");
    expect(dishesOf(replanned, KEPT)).toEqual(dishesOf(plan, KEPT));
    expect(replanned.regeneration.kept).toBe(KEPT.length);
    const free = replanned.slots.filter((slot) => !KEPT.includes(slot.slotId));
    expect(free.every((slot) => slot.source === "AUTO" && !slot.locked && slot.dishId !== null)).toBe(true);
    expect(replanned.regeneration.changed).toBe(free.filter((slot) => dishesOf(plan, [slot.slotId])[0] !== slot.dishId).length);
    expect(replanned.violations.filter((violation) => violation.severity === "HARD")).toEqual([]);
    expect(storedSeed(meals)).not.toBe(seed);
  });

  it("keeps cooked meals, too", () => {
    const slot: StoredPlanSlot = { slotId: "2026-10-16#DINNER", dishId: "a", locked: false, source: "AUTO", status: "PLANNED" };
    expect(isKept(slot, "2026-10-14")).toBe(false);
    expect(isKept({ ...slot, status: "COOKED" }, "2026-10-14")).toBe(true);
    expect(isKept(slot, "2026-10-17")).toBe(true);
  });

  it("restores the previous dishes of the replanned meals (undo)", async () => {
    const { services, plan } = await planned();
    const replanned = await services.plans.regenerateWeek(TEST_IDENTITY, "current");
    const restore = replanned.slots.filter((slot) => !KEPT.includes(slot.slotId)).map((slot) => ({ slotId: slot.slotId, dishId: dishesOf(plan, [slot.slotId])[0] ?? null }));
    const undone = await services.plans.regenerateWeek(TEST_IDENTITY, "current", { restore });
    expect(undone.slots.map((slot) => slot.dishId)).toEqual(plan.slots.map((slot) => slot.dishId));
    expect(undone.regeneration.kept).toBe(KEPT.length);
    await expect(services.plans.regenerateWeek(TEST_IDENTITY, "current", { restore: [{ slotId: "2026-10-16#DINNER", dishId: null }] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(services.plans.regenerateWeek(TEST_IDENTITY, "current", { restore: [{ slotId: "2026-10-17#DINNER", dishId: "unknown" }] })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("needs an existing plan and reports parallel changes as 409", async () => {
    const { services, meals } = await planned();
    await expect(services.plans.regenerateWeek(TEST_IDENTITY, "next")).rejects.toMatchObject({ statusCode: 404 });
    const original = meals.sender.send.bind(meals.sender);
    let bumped = false;
    meals.sender.send = async (command) => {
      if (!bumped && command.constructor.name === "PutCommand") {
        bumped = true;
        const stored = meals.items.get("default|PLAN#2026-10-12");
        if (stored) meals.items.set("default|PLAN#2026-10-12", { ...stored, version: Number(stored.version) + 1 });
      }
      return original(command);
    };
    await expect(services.plans.regenerateWeek(TEST_IDENTITY, "current")).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  });

  it("returns today and tomorrow in household time (FOOD-017)", async () => {
    const { services } = setup();
    await ready(services);
    const ahead = await services.plans.mealsAhead("default", 2);
    const current = await services.plans.getPlan("default", "current");
    expect(ahead.today).toBe("2026-10-14");
    expect(ahead.days.map((day) => day.date)).toEqual(["2026-10-14", "2026-10-15"]);
    expect(ahead.days[0]?.meals.map((meal) => [meal.slot, meal.dish?.name])).toEqual(
      current.slots.filter((slot) => slot.date === "2026-10-14").map((slot) => [slot.slot, slot.dish?.name]),
    );
  });

  it("takes tomorrow from the next week's plan on the last day of a week (FOOD-017)", async () => {
    const { services } = setup("MONDAY", new Date("2026-10-18T08:00:00Z"));
    await ready(services);
    const ahead = await services.plans.mealsAhead("default", 2);
    expect(ahead.days.map((day) => day.date)).toEqual(["2026-10-18", "2026-10-19"]);
    expect(ahead.days[1]?.meals).toHaveLength(2);
    expect(ahead.days[1]?.meals.every((meal) => meal.dish !== null)).toBe(true);
  });
});

