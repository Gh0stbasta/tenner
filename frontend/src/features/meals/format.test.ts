import { describe, expect, it } from "vitest";
import { mealPlanFixture } from "../../tests/fixtures";
import type { PlanSlot } from "./api";
import { dayNutrition, heavyLunchHint, nutritionLine } from "./format";

const estimate = (kcal: number, complete = true) => ({
  kcal,
  protein: 20,
  carbs: 60,
  fat: 15,
  source: "INGREDIENTS" as const,
  complete,
});
const slotsOf = (date: string) =>
  (mealPlanFixture().slots as unknown as PlanSlot[]).filter((slot) => slot.date === date);
const withKcal = (slot: PlanSlot, kcal: number, complete = true): PlanSlot => ({
  ...slot,
  dish: slot.dish && { ...slot.dish, nutrition: estimate(kcal, complete) },
});
const RULES = { lightLunchOnWeekdays: true, lightLunchMaxKcal: 600 };

describe("nutrition display (FOOD-012)", () => {
  it("formats an estimate and marks partial ones", () => {
    expect(nutritionLine(estimate(520))).toBe("ca. 520 kcal · 20 g Eiweiß · 60 g KH · 15 g Fett");
    expect(nutritionLine(estimate(520, false))).toBe("mind. 520 kcal · 20 g Eiweiß · 60 g KH · 15 g Fett");
  });

  it("adds lunch and dinner of a day", () => {
    const [lunch, dinner] = slotsOf("2026-10-14") as [PlanSlot, PlanSlot];
    expect(dayNutrition([withKcal(lunch, 430), withKcal(dinner, 784)])).toEqual({ kcal: 1210, complete: true });
    expect(dayNutrition([withKcal(lunch, 430), dinner])).toEqual({ kcal: 430, complete: false });
    expect(dayNutrition([withKcal(lunch, 430, false), { ...dinner, dish: null }])).toEqual({
      kcal: 430,
      complete: false,
    });
    expect(dayNutrition([lunch, dinner])).toBeNull();
  });

  it("hints at heavy weekday lunches above the threshold only", () => {
    const [lunch, dinner] = slotsOf("2026-10-14") as [PlanSlot, PlanSlot];
    const [saturdayLunch] = slotsOf("2026-10-17") as [PlanSlot];
    expect(heavyLunchHint(withKcal(lunch, 750), RULES)).toEqual({
      rule: "NUTRITION",
      severity: "SOFT",
      slotIds: ["2026-10-14#LUNCH"],
      message: "ca. 750 kcal: für mittags unter der Woche eher schwer",
    });
    expect(heavyLunchHint(withKcal(lunch, 600), RULES)).toBeNull();
    expect(heavyLunchHint(withKcal(dinner, 1200), RULES)).toBeNull();
    expect(heavyLunchHint(withKcal(saturdayLunch, 1200), RULES)).toBeNull();
    expect(heavyLunchHint(withKcal(lunch, 750), { ...RULES, lightLunchOnWeekdays: false })).toBeNull();
    expect(heavyLunchHint(withKcal(lunch, 750), undefined)).toBeNull();
  });
});
