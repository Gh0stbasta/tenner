/**
 * Creating a dish with a chat AI (MAINT-012): the prompt for „KI-Prompt kopieren“ and the import of the AI's JSON
 * answer into the editor draft. No AI is called from the app (ADR 0009); the owner copies and pastes.
 */

import { z } from "zod";
import type { Ingredient } from "./api";
import {
  DISH_CATEGORIES,
  DISH_CATEGORY_LABELS,
  DISH_LIMITS,
  QUANTITY_UNITS,
  unitsFor,
  type DishIngredient,
  type DishInput,
} from "./dishes";

const json = (value: unknown) => JSON.stringify(value, null, 2);

const EXAMPLE = {
  name: "Spaghetti Bolognese",
  group: "Spaghetti",
  category: "PASTA",
  slots: ["LUNCH", "DINNER"],
  lightness: "FILLING",
  temperature: "WARM",
  activeMinutes: 20,
  totalMinutes: 45,
  vegetarianVariant: "mit Linsen statt Hackfleisch",
  familyFriendly: true,
  isBurger: false,
  ingredients: [
    { name: "Spaghetti", quantity: 125, unit: "g", optional: false },
    { name: "Parmesan", quantity: 1, unit: "EL", optional: true },
  ],
};

/** The prompt for a chat AI: task, format, allowed values and the catalog ingredient names (no household data). */
export function buildDishPrompt(catalog: readonly Ingredient[]): string {
  const categories = DISH_CATEGORIES.map((category) => `${category} (${DISH_CATEGORY_LABELS[category]})`).join(", ");
  const ingredients = [...catalog]
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((ingredient) => `- ${ingredient.name} [${unitsFor(ingredient).join(", ")}]`);
  return [
    "Du hilfst mir, ein Gericht für unseren Familien-Essensplan anzulegen.",
    "Das Gericht: <HIER DAS GERICHT BESCHREIBEN, z. B. „Gemüse-Lasagne“>",
    "",
    "Antworte NUR mit einem JSON-Objekt in genau diesem Format, ohne Erklärungen:",
    json(EXAMPLE),
    "",
    "Regeln:",
    `- name: ${DISH_LIMITS.nameMin} bis ${DISH_LIMITS.nameMax} Zeichen, deutscher Name des Gerichts.`,
    `- group: Oberbegriff für ähnliche Gerichte (höchstens ${DISH_LIMITS.groupMax} Zeichen) oder null.`,
    `- category: genau einer von ${categories}.`,
    "- slots: LUNCH (Mittag), DINNER (Abend) oder beides.",
    "- lightness: LIGHT (leicht) oder FILLING (sättigend). temperature: WARM oder COLD.",
    `- activeMinutes: aktive Arbeitszeit, ganze Minuten 1 bis ${DISH_LIMITS.activeMinutesMax}.`,
    `- totalMinutes: Gesamtzeit inkl. Garen, ganze Minuten 1 bis ${DISH_LIMITS.totalMinutesMax}, nicht kleiner als activeMinutes.`,
    `- vegetarianVariant: kurze vegetarische Abwandlung (höchstens ${DISH_LIMITS.variantMax} Zeichen) oder null.`,
    "- familyFriendly: true, wenn Kinder es meist mögen. isBurger: true nur für Burger.",
    `- ingredients: 1 bis ${DISH_LIMITS.ingredientsMax} Zutaten. Mengen für EINE Erwachsenenportion (die App rechnet auf die Familie hoch), Zahl größer 0 bis ${DISH_LIMITS.quantityMax}.`,
    `  unit: eine der Einheiten in eckigen Klammern hinter der Zutat (${QUANTITY_UNITS.join(", ")}).`,
    "  optional: true für Zutaten, die man weglassen kann (z. B. Topping).",
    "- Verwende für name in ingredients möglichst genau einen Namen aus dieser Liste. Fehlt eine wichtige Zutat,",
    "  nimm trotzdem einen kurzen deutschen Namen; ich lege sie dann selbst an.",
    "",
    "Zutaten (Name [erlaubte Einheiten]):",
    ...ingredients,
  ].join("\n");
}

const importSchema = z.object({
  name: z.string(),
  group: z.string().nullish(),
  category: z.enum(DISH_CATEGORIES),
  slots: z.array(z.enum(["LUNCH", "DINNER"])).min(1),
  lightness: z.enum(["LIGHT", "FILLING"]),
  temperature: z.enum(["WARM", "COLD"]),
  activeMinutes: z.number(),
  totalMinutes: z.number(),
  vegetarianVariant: z.string().nullish(),
  familyFriendly: z.boolean().default(true),
  isBurger: z.boolean().default(false),
  ingredients: z
    .array(
      z.object({
        name: z.string().optional(),
        ingredientId: z.string().optional(),
        quantity: z.number(),
        unit: z.string(),
        optional: z.boolean().default(false),
      }),
    )
    .min(1),
});

export type DishImport =
  | { readonly ok: true; readonly draft: DishInput; readonly unknownIngredients: readonly string[] }
  | { readonly ok: false; readonly message: string };

/** The JSON object in an AI answer: tolerates code fences and text before and after it. */
function extractObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new SyntaxError("no object");
  return JSON.parse(text.slice(start, end + 1));
}

const normalize = (name: string) => name.trim().toLocaleLowerCase("de");

/** Reads an AI answer into an editor draft; ingredients are matched to the catalog by id or name. */
export function parseDishJson(text: string, catalog: readonly Ingredient[]): DishImport {
  let raw: unknown;
  try {
    raw = extractObject(text);
  } catch {
    return { ok: false, message: "Kein gültiges JSON gefunden. Bitte die Antwort der KI vollständig einfügen." };
  }
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".") || "JSON";
    return { ok: false, message: `Das JSON passt nicht zum Format: „${field}“ fehlt oder hat einen falschen Wert.` };
  }
  const data = parsed.data;
  const byId = new Map(catalog.map((ingredient) => [ingredient.ingredientId, ingredient]));
  const byName = new Map(catalog.map((ingredient) => [normalize(ingredient.name), ingredient]));
  const ingredients: DishIngredient[] = [];
  const unknownIngredients: string[] = [];
  for (const entry of data.ingredients) {
    const ingredient =
      (entry.ingredientId ? byId.get(entry.ingredientId) : undefined) ??
      (entry.name ? byName.get(normalize(entry.name)) : undefined);
    if (!ingredient) {
      unknownIngredients.push(entry.name ?? entry.ingredientId ?? "?");
      continue;
    }
    if (ingredients.some((known) => known.ingredientId === ingredient.ingredientId)) continue;
    const allowed = unitsFor(ingredient);
    const unit = allowed.find((candidate) => candidate === entry.unit) ?? ingredient.unit;
    ingredients.push({
      ingredientId: ingredient.ingredientId,
      quantity: entry.quantity,
      unit,
      optional: entry.optional,
    });
  }
  return {
    ok: true,
    unknownIngredients,
    draft: {
      name: data.name.trim(),
      group: data.group?.trim() || null,
      category: data.category,
      slots: [...new Set(data.slots)],
      lightness: data.lightness,
      temperature: data.temperature,
      ingredients,
      activeMinutes: data.activeMinutes,
      totalMinutes: data.totalMinutes,
      vegetarianVariant: data.vegetarianVariant?.trim() || null,
      familyFriendly: data.familyFriendly,
      isBurger: data.isBurger,
      nutritionOverride: null,
    },
  };
}
