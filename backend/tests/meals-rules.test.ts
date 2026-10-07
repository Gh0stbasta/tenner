/** FOOD-005: the household's planning rules R1 – R13. */

import { describe, expect, it } from "vitest";
import { checkSlot, checkWeek, dishViolations, hasHardViolation, score, weekViolations, type DishResponse, type PlannedMeal, type RuleId } from "../src/meals/index.js";
import type { Weekday } from "../src/models/enums.js";
import { catalogDishResponses, dishNamed, familyProfile } from "./mocks/meals.js";

const DISHES = catalogDishResponses();
const dish = (name: string) => dishNamed(DISHES, name);
const PROFILE = familyProfile();

/** Week of 2026-10-12 (Monday). */
const DATES: Readonly<Record<Weekday, string>> = { MON: "2026-10-12", TUE: "2026-10-13", WED: "2026-10-14", THU: "2026-10-15", FRI: "2026-10-16", SAT: "2026-10-17", SUN: "2026-10-18" };
const meal = (weekday: Weekday, slot: "LUNCH" | "DINNER", dishOrName: DishResponse | string | null): PlannedMeal => ({
  slotId: `${DATES[weekday]}#${slot}`,
  date: DATES[weekday],
  weekday,
  slot,
  dish: typeof dishOrName === "string" ? dish(dishOrName) : dishOrName,
});
const rulesOf = (violations: readonly { rule: RuleId }[]) => violations.map((violation) => violation.rule);
const at = (weekday: Weekday, slot: "LUNCH" | "DINNER", name: string, profile = PROFILE) => rulesOf(dishViolations(dish(name), meal(weekday, slot, name), profile));

describe("dish rules", () => {
  it("SLOT: dishes only at their meals", () => {
    expect(at("SAT", "DINNER", "Kaiserschmarrn")).toContain("SLOT");
    expect(at("SAT", "LUNCH", "Kaiserschmarrn")).not.toContain("SLOT");
  });

  it("R1: no allergen for anyone at the table; optional sides do not count", () => {
    const withApple = { ...dish("Kartoffelpuffer"), tags: ["APPLE" as const] };
    expect(rulesOf(dishViolations(withApple, meal("SAT", "DINNER", withApple), PROFILE))).toContain("R1");
    expect(at("SAT", "DINNER", "Kartoffelpuffer")).not.toContain("R1");
    const childAllergy = familyProfile();
    const withChildAllergy = { ...childAllergy, eaters: childAllergy.eaters.map((eater) => (eater.eaterId === "k1" ? { ...eater, allergies: ["MILK" as const] } : eater)) };
    expect(at("MON", "LUNCH", "Mikrowellenrisotto", withChildAllergy)).not.toContain("R1");
    expect(at("SAT", "LUNCH", "Mikrowellenrisotto", withChildAllergy)).toContain("R1");
  });

  it("R2: vegetarian with exceptions and variants", () => {
    expect(at("WED", "DINNER", "Spaghetti Bolognese")).not.toContain("R2");
    expect(at("WED", "DINNER", "Hot Dogs")).not.toContain("R2");
    expect(at("WED", "DINNER", "Köttbullar")).not.toContain("R2");
    const noVariant: DishResponse = Object.fromEntries(Object.entries(dish("Köttbullar")).filter(([key]) => key !== "vegetarianVariant")) as unknown as DishResponse;
    expect(rulesOf(dishViolations(noVariant, meal("WED", "DINNER", noVariant), PROFILE))).toContain("R2");
  });

  it("R3: household and personal dislikes", () => {
    expect(at("WED", "DINNER", "Gemüsecurry", familyProfile({ dislikeTags: ["COCONUT"] }))).toContain("R3");
    const picky = familyProfile();
    const dislikesPeas = { ...picky, eaters: picky.eaters.map((eater) => (eater.eaterId === "k2" ? { ...eater, dislikeIngredients: ["peas-frozen"] } : eater)) };
    expect(at("WED", "DINNER", "Spätzle", dislikesPeas)).toContain("R3");
    expect(at("WED", "DINNER", "Spätzle")).not.toContain("R3");
  });

  it("R4: active time limit", () => {
    expect(at("WED", "DINNER", "Lasagne")).not.toContain("R4");
    expect(at("WED", "DINNER", "Lasagne", familyProfile({ maxActiveMinutes: 15 }))).toContain("R4");
  });

  it("R5: chicken only on Monday or Tuesday dinner", () => {
    expect(at("MON", "DINNER", "Chicken Dinos mit Pommes")).not.toContain("R5");
    expect(at("TUE", "DINNER", "Chicken Dinos mit Pommes")).not.toContain("R5");
    expect(at("WED", "DINNER", "Chicken Dinos mit Pommes")).toContain("R5");
    expect(at("MON", "LUNCH", "Salat mit Hähnchen")).toContain("R5");
  });

  it("R9: weekday lunches light, weekend lunches free", () => {
    expect(at("WED", "LUNCH", "Lasagne")).toContain("R9");
    expect(at("WED", "LUNCH", "Onigiri")).not.toContain("R9");
    expect(at("SAT", "LUNCH", "Lasagne")).not.toContain("R9");
    expect(at("WED", "LUNCH", "Lasagne", familyProfile({ lightLunchOnWeekdays: false }))).not.toContain("R9");
  });

  it("R13: family-friendly dishes only", () => {
    const fancy = { ...dish("Ramen"), familyFriendly: false };
    expect(rulesOf(dishViolations(fancy, meal("SAT", "LUNCH", fancy), PROFILE))).toEqual(["R13"]);
  });

  it("names the rule, the slot and a German message", () => {
    const [violation] = dishViolations(dish("Chicken Dinos mit Pommes"), meal("WED", "DINNER", "Chicken Dinos mit Pommes"), PROFILE);
    expect(violation).toEqual({ rule: "R5", severity: "HARD", slotIds: ["2026-10-14#DINNER"], message: "Hühnchen nicht Mittwoch abends." });
  });
});

describe("week rules", () => {
  it("R5: chicken at most once", () => {
    const week = [meal("MON", "DINNER", "Chicken Dinos mit Pommes"), meal("TUE", "DINNER", "Salat mit Hähnchen")];
    expect(rulesOf(weekViolations(week, PROFILE))).toContain("R5");
  });

  it("R6: burger at most once", () => {
    const week = [meal("WED", "DINNER", "Burger"), meal("SAT", "DINNER", "Piratenburger")];
    expect(rulesOf(weekViolations(week, PROFILE))).toContain("R6");
  });

  it("R7: each protein form once; egg is not limited", () => {
    expect(rulesOf(weekViolations([meal("WED", "DINNER", "Fischstäbchen mit Erbsenpüree"), meal("FRI", "DINNER", "Gebratener Lachs mit Gemüse")], PROFILE))).toContain("R7");
    expect(rulesOf(weekViolations([meal("WED", "DINNER", "Spaghetti Bolognese"), meal("FRI", "DINNER", "Lasagne")], PROFILE))).toContain("R7");
    const threeForms = [meal("WED", "DINNER", "Spaghetti Bolognese"), meal("THU", "DINNER", "Bratkartoffeln mit Würstl"), meal("FRI", "DINNER", "Burger")];
    expect(rulesOf(weekViolations(threeForms, PROFILE))).not.toContain("R7");
    expect(rulesOf(weekViolations([meal("WED", "LUNCH", "Eierreis mit Gemüse"), meal("THU", "LUNCH", "Salat mit Ei")], PROFILE))).not.toContain("R7");
  });

  it("R8: one base ingredient per day", () => {
    expect(rulesOf(weekViolations([meal("SAT", "LUNCH", "Nudeln mit Soße"), meal("SAT", "DINNER", "Spätzle")], PROFILE))).toContain("R8");
    expect(rulesOf(weekViolations([meal("SAT", "LUNCH", "Nudeln mit Soße"), meal("SAT", "DINNER", "Chili")], PROFILE))).not.toContain("R8");
    expect(rulesOf(weekViolations([meal("SAT", "LUNCH", "Gnocchi in Tomatensoße"), meal("SAT", "DINNER", "Schupfnudeln")], PROFILE))).not.toContain("R8");
  });

  it("R10: warm, filling dinners preferred (soft)", () => {
    const [violation] = weekViolations([meal("WED", "DINNER", "Onigiri")], PROFILE);
    expect(violation).toMatchObject({ rule: "R10", severity: "SOFT" });
  });

  it("R11: salad lunches soft above the limit, hard above twice the limit", () => {
    const salads = ["Salat mit Halloumi", "Salat mit Ei", "Salat mit Feta", "Salat mit Lachs", "Salat mit Hähnchen"];
    const days: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI"];
    const three = days.slice(0, 3).map((day, index) => meal(day, "LUNCH", salads[index] ?? ""));
    expect(weekViolations(three, PROFILE).filter((violation) => violation.rule === "R11")).toMatchObject([{ severity: "SOFT" }]);
    const five = days.map((day, index) => meal(day, "LUNCH", salads[index] ?? ""));
    expect(weekViolations(five, familyProfile({ maxSaladLunchesPerWeek: 1 })).filter((violation) => violation.rule === "R11")).toMatchObject([{ severity: "HARD" }]);
  });

  it("R12: no dish or group twice; last week's dishes soft", () => {
    expect(rulesOf(weekViolations([meal("MON", "LUNCH", "Onigiri"), meal("WED", "LUNCH", "Onigiri")], PROFILE))).toContain("R12");
    expect(rulesOf(weekViolations([meal("MON", "LUNCH", "Gnocchi in Tomatensoße"), meal("WED", "DINNER", "Gnocchi in Spinatsoße")], PROFILE))).toContain("R12");
    const recent = weekViolations([meal("MON", "LUNCH", "Onigiri")], PROFILE, { recentDishIds: new Set([dish("Onigiri").dishId]) });
    expect(recent).toMatchObject([{ rule: "R12", severity: "SOFT" }]);
  });

  it("ignores empty meals", () => {
    expect(checkWeek([meal("MON", "LUNCH", null)], PROFILE)).toEqual([]);
  });
});

describe("checkSlot, hasHardViolation and score", () => {
  const week = [meal("MON", "DINNER", "Chicken Dinos mit Pommes"), meal("TUE", "DINNER", null), meal("WED", "LUNCH", "Onigiri")];

  it("checks one meal in the context of the week", () => {
    expect(rulesOf(checkSlot(week, "2026-10-13#DINNER", dish("Salat mit Hähnchen"), PROFILE))).toEqual(["R5", "R7", "R10"]);
    expect(checkSlot(week, "2026-10-13#DINNER", dish("Spätzle mit Soße"), PROFILE)).toEqual([]);
    expect(hasHardViolation(checkSlot(week, "2026-10-14#LUNCH", dish("Lasagne"), PROFILE))).toBe(true);
  });

  it("scores soft rules, empty meals, favorites, likes and dislikes", () => {
    const base = score([meal("WED", "DINNER", "Lasagne")], PROFILE);
    expect(score([meal("WED", "DINNER", "Onigiri")], PROFILE)).toBeLessThan(base);
    expect(score([meal("WED", "DINNER", null)], PROFILE)).toBeLessThan(base);
    expect(score([meal("WED", "DINNER", { ...dish("Lasagne"), favorite: true })], PROFILE)).toBeGreaterThan(base);
    expect(score([meal("WED", "DINNER", "Lasagne")], PROFILE, { dislikedDishIds: new Set([dish("Lasagne").dishId]) })).toBeLessThan(base);
    const likes = familyProfile();
    const likesPasta = { ...likes, eaters: likes.eaters.map((eater) => ({ ...eater, likeIngredients: ["lasagne-sheets"], likeGroups: ["Tortellini"] })) };
    expect(score([meal("WED", "DINNER", "Lasagne")], likesPasta)).toBeGreaterThan(base);
    expect(score([meal("WED", "DINNER", "Tortellini")], likesPasta)).toBeGreaterThan(score([meal("WED", "DINNER", "Tortellini")], PROFILE));
  });

  it("finds no hard violation in a hand-made valid week", () => {
    const valid = [
      meal("MON", "LUNCH", "Onigiri"),
      meal("MON", "DINNER", "Chicken Dinos mit Pommes"),
      meal("TUE", "LUNCH", "Salat mit Halloumi"),
      meal("TUE", "DINNER", "Spaghetti Bolognese"),
      meal("WED", "LUNCH", "Linseneintopf"),
      meal("WED", "DINNER", "Käsespätzle mit Röstzwiebeln"),
      meal("THU", "LUNCH", "Eierreis mit Gemüse"),
      meal("THU", "DINNER", "Burger"),
      meal("FRI", "LUNCH", "Ofengemüse mit Kräuterquark"),
      meal("FRI", "DINNER", "Fischstäbchen mit Erbsenpüree"),
      meal("SAT", "LUNCH", "Kaiserschmarrn"),
      meal("SAT", "DINNER", "Hot Dogs"),
      meal("SUN", "LUNCH", "Gnocchi in Tomatensoße"),
      meal("SUN", "DINNER", "Flammkuchen"),
    ];
    expect(checkWeek(valid, PROFILE).filter((violation) => violation.severity === "HARD")).toEqual([]);
  });
});
