/** German labels of the meal planning enums (release 2.0). */

export const INGREDIENT_TAGS = [
  "GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOY",
  "MILK",
  "NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHITES",
  "LUPIN",
  "MOLLUSCS",
  "APPLE",
  "COCONUT",
  "MEAT",
  "POULTRY",
  "PORK",
  "BEEF",
  "TOFU",
  "QUINOA",
  "BLUE_CHEESE",
] as const;
export type IngredientTag = (typeof INGREDIENT_TAGS)[number];

export const TAG_LABELS: Readonly<Record<IngredientTag, string>> = {
  GLUTEN: "Gluten",
  CRUSTACEANS: "Krebstiere",
  EGGS: "Eier",
  FISH: "Fisch",
  PEANUTS: "Erdnüsse",
  SOY: "Soja",
  MILK: "Milch",
  NUTS: "Nüsse",
  CELERY: "Sellerie",
  MUSTARD: "Senf",
  SESAME: "Sesam",
  SULPHITES: "Sulfite",
  LUPIN: "Lupinen",
  MOLLUSCS: "Weichtiere",
  APPLE: "Äpfel",
  COCONUT: "Kokos",
  MEAT: "Fleisch",
  POULTRY: "Geflügel",
  PORK: "Schwein",
  BEEF: "Rind",
  TOFU: "Tofu",
  QUINOA: "Quinoa",
  BLUE_CHEESE: "Schimmelkäse",
};

/** Animal protein sources of rule R7; beef and pork by form. */
export const PROTEIN_TAGS = ["POULTRY", "FISH", "MINCE", "BURGER_PATTY", "SAUSAGE", "MEATBALL", "HAM"] as const;
export type ProteinTag = (typeof PROTEIN_TAGS)[number];

export const PROTEIN_LABELS: Readonly<Record<ProteinTag, string>> = {
  POULTRY: "Geflügel",
  FISH: "Fisch",
  MINCE: "Hackfleisch",
  BURGER_PATTY: "Burger-Patty",
  SAUSAGE: "Würstchen",
  MEATBALL: "Hackbällchen",
  HAM: "Schinken",
};

export const WEEKDAY_SHORT = { MON: "Mo", TUE: "Di", WED: "Mi", THU: "Do", FRI: "Fr", SAT: "Sa", SUN: "So" } as const;
export type Weekday = keyof typeof WEEKDAY_SHORT;
export const MEAL_SLOT_LABELS = { LUNCH: "Mittag", DINNER: "Abend" } as const;
export type MealSlot = keyof typeof MEAL_SLOT_LABELS;
export type WeekSlot = `${Weekday}#${MealSlot}`;

export const WEEK_SLOTS: readonly WeekSlot[] = (Object.keys(WEEKDAY_SHORT) as Weekday[]).flatMap((day) => [
  `${day}#LUNCH` as const,
  `${day}#DINNER` as const,
]);

export function weekSlotLabel(slot: WeekSlot): string {
  const [day, meal] = slot.split("#") as [Weekday, MealSlot];
  return `${WEEKDAY_SHORT[day]} ${MEAL_SLOT_LABELS[meal]}`;
}

/** „Nüsse, Äpfel“ for a list of tags. */
export function tagList(tags: readonly IngredientTag[]): string {
  return tags.map((tag) => TAG_LABELS[tag]).join(", ");
}

/** Meal kinds of the attendance setting (EPIC-FOOD-001, decision 5). */
export const ATTENDANCE_LABELS = {
  weekdayLunch: "Mittags Mo – Fr",
  weekendLunch: "Mittags am Wochenende",
  dinner: "Abends",
} as const;
export type AttendanceMeal = keyof typeof ATTENDANCE_LABELS;
