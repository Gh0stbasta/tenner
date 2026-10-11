import { describe, expect, it } from "vitest";
import { EGG, INGREDIENTS, SPAGHETTI } from "../../tests/dishFixtures";
import { buildDishPrompt, parseDishJson } from "./dishImport";
import { validateDraft } from "./dishes";

const ANSWER = {
  name: " Spaghetti mit Ei ",
  group: "Spaghetti",
  category: "PASTA",
  slots: ["LUNCH", "DINNER", "LUNCH"],
  lightness: "FILLING",
  temperature: "WARM",
  activeMinutes: 15,
  totalMinutes: 25,
  vegetarianVariant: null,
  familyFriendly: true,
  isBurger: false,
  ingredients: [
    { name: "spaghetti", quantity: 500, unit: "g", optional: false },
    { name: "Ei", quantity: 4, unit: "g" },
    { ingredientId: "i-nuts", quantity: 2, unit: "EL", optional: true },
    { name: "Safran", quantity: 1, unit: "g" },
  ],
};

describe("buildDishPrompt (MAINT-012)", () => {
  it("describes the format, the allowed values and every catalog ingredient with its units", () => {
    const prompt = buildDishPrompt(INGREDIENTS);
    expect(prompt).toContain("Antworte NUR mit einem JSON-Objekt");
    expect(prompt).toContain('"activeMinutes": 20');
    expect(prompt).toContain("PASTA (Nudeln)");
    expect(prompt).toContain("ganze Minuten 1 bis 240");
    expect(prompt).toContain("Mengen für EINE Erwachsenenportion");
    expect(prompt).toContain("- Spaghetti [g, EL, TL]");
    expect(prompt).toContain("- Ei [Stück]");
    for (const ingredient of INGREDIENTS) expect(prompt).toContain(`- ${ingredient.name} [`);
    expect(prompt).not.toMatch(/Erwachsener|Allergie/);
  });
});

describe("parseDishJson (MAINT-012)", () => {
  it("fills a valid draft from an AI answer with code fences and text around it", () => {
    const text = `Gern! Hier ist das Gericht:\n\`\`\`json\n${JSON.stringify(ANSWER)}\n\`\`\`\nGuten Appetit!`;
    const result = parseDishJson(text, INGREDIENTS);
    if (!result.ok) throw new Error(result.message);
    expect(result.draft).toEqual({
      name: "Spaghetti mit Ei",
      group: "Spaghetti",
      category: "PASTA",
      slots: ["LUNCH", "DINNER"],
      lightness: "FILLING",
      temperature: "WARM",
      activeMinutes: 15,
      totalMinutes: 25,
      vegetarianVariant: null,
      familyFriendly: true,
      isBurger: false,
      nutritionOverride: null,
      ingredients: [
        { ingredientId: SPAGHETTI.ingredientId, quantity: 500, unit: "g", optional: false },
        { ingredientId: EGG.ingredientId, quantity: 4, unit: "Stück", optional: false },
        { ingredientId: "i-nuts", quantity: 2, unit: "EL", optional: true },
      ],
    });
    expect(result.unknownIngredients).toEqual(["Safran"]);
    expect(validateDraft(result.draft)).toEqual({});
  });

  it("uses defaults for missing optional fields and keeps duplicates out", () => {
    const optionalFields = new Set(["familyFriendly", "isBurger", "group", "vegetarianVariant"]);
    const pasta = { name: "Spaghetti", quantity: 500, unit: "g" };
    const rest: Record<string, unknown> = {
      ...Object.fromEntries(Object.entries(ANSWER).filter(([field]) => !optionalFields.has(field))),
      ingredients: [pasta, pasta],
    };
    const result = parseDishJson(JSON.stringify(rest), INGREDIENTS);
    if (!result.ok) throw new Error(result.message);
    expect(result.draft).toMatchObject({ familyFriendly: true, isBurger: false, group: null, vegetarianVariant: null });
    expect(result.draft.ingredients).toHaveLength(1);
  });

  it("rejects text without JSON and JSON with wrong values", () => {
    expect(parseDishJson("Das weiß ich leider nicht.", INGREDIENTS)).toEqual({
      ok: false,
      message: "Kein gültiges JSON gefunden. Bitte die Antwort der KI vollständig einfügen.",
    });
    expect(parseDishJson("{ name: kaputt }", INGREDIENTS).ok).toBe(false);
    expect(parseDishJson(JSON.stringify({ ...ANSWER, category: "PIZZA" }), INGREDIENTS)).toEqual({
      ok: false,
      message: "Das JSON passt nicht zum Format: „category“ fehlt oder hat einen falschen Wert.",
    });
    expect(parseDishJson(JSON.stringify({ ...ANSWER, ingredients: [] }), INGREDIENTS).ok).toBe(false);
  });
});
