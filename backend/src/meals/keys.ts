/**
 * Sort keys of the meals table (FOOD-001, ADR 0007). The only place that builds or parses `itemKey` values, so every
 * item kind keeps its prefix.
 */

export const MEAL_ITEM_KINDS = ["DISH", "INGREDIENT", "PROFILE", "PLAN", "LIST", "CALENDAR"] as const;
export type MealItemKind = (typeof MEAL_ITEM_KINDS)[number];

const SEPARATOR = "#";

/** Kinds stored once per household (no ID after the prefix). */
const SINGLETON_KINDS: ReadonlySet<MealItemKind> = new Set(["PROFILE", "CALENDAR"]);

/** `DISH#<id>`, `PLAN#<weekStart>` …; `PROFILE` and `CALENDAR` (FOOD-015) have no ID. */
export function itemKey(kind: MealItemKind, id?: string): string {
  if (SINGLETON_KINDS.has(kind)) {
    if (id !== undefined) throw new Error(`${kind} items have no ID.`);
    return kind;
  }
  if (!id || id.includes(SEPARATOR)) throw new Error(`Invalid ${kind} ID.`);
  return `${kind}${SEPARATOR}${id}`;
}

/** Prefix for querying all items of a kind, e.g. `DISH#`. */
export function itemKeyPrefix(kind: Exclude<MealItemKind, "PROFILE" | "CALENDAR">): string {
  return `${kind}${SEPARATOR}`;
}

/** The ID part of a key of the given kind; undefined if the key belongs to another kind. */
export function idOfItemKey(kind: Exclude<MealItemKind, "PROFILE" | "CALENDAR">, key: string): string | undefined {
  const prefix = itemKeyPrefix(kind);
  return key.startsWith(prefix) && key.length > prefix.length ? key.slice(prefix.length) : undefined;
}
