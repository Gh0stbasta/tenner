import { describe, expect, it } from "vitest";
import { mealPlanFixture } from "../../tests/fixtures";
import type { PlanSlot } from "./api";
import {
  costLine,
  costRange,
  costTier,
  dayNutrition,
  familyCost,
  familyFactors,
  formatEuro,
  heavyLunchHint,
  nutritionLine,
} from "./format";

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

describe("cost display (FOOD-013)", () => {
  const TIERS = { cheapMax: 6, mediumMax: 10 };
  const fromIngredients = {
    perAdultPortion: 2.4,
    pantry: 0.3,
    familyOverride: null,
    source: "INGREDIENTS" as const,
    complete: true,
  };

  it("prices the family by portion factors, or takes the family's own amount", () => {
    expect(familyFactors([{ portionFactor: 1 }, { portionFactor: 1 }, { portionFactor: 0.5 }])).toBe(2.5);
    expect(familyFactors([])).toBe(1);
    expect(familyFactors(undefined)).toBe(1);
    expect(familyCost(fromIngredients, 2.5)).toBe(6.3);
    expect(familyCost({ ...fromIngredients, perAdultPortion: null, familyOverride: 12, source: "OVERRIDE" }, 2.5)).toBe(
      12,
    );
  });

  it("puts the boundaries into the lower tier", () => {
    expect(costTier(6, TIERS)).toBe("€");
    expect(costTier(6.01, TIERS)).toBe("€€");
    expect(costTier(10, TIERS)).toBe("€€");
    expect(costTier(10.5, TIERS)).toBe("€€€");
    expect(costTier(7, { cheapMax: 8, mediumMax: 12 })).toBe("€");
  });

  it("shows a 2-euro range", () => {
    expect(costRange(8.7)).toBe("ca. 8–10 €");
    expect(costRange(5)).toBe("ca. 4–6 €");
    expect(costRange(1.2)).toBe("unter 2 €");
    expect(costLine(fromIngredients, 2.5, TIERS)).toBe("€€ · ca. 6–8 €");
    expect(costLine({ ...fromIngredients, complete: false }, 1, TIERS)).toBe("€ · ca. 2–4 € (ohne fehlende Zutaten)");
    expect(formatEuro(4.6)).toMatch(/^4,60\s€$/);
  });
});
