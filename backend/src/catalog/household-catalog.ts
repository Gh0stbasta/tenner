/**
 * Household task catalog (DATA-008) from the owner's list (docs/human/householdTaskSeed.md, German titles).
 * Imported once into the household by POST /household/catalog; the import skips titles that already exist.
 */

import type { Category, FrequencyUnit, MemberColor, UserId, Weekday } from "../models/index.js";

export interface CatalogMember {
  readonly userId: UserId;
  readonly displayName: string;
  readonly color: MemberColor;
  /** HOUSEHOLD-ADMIN-006. */
  readonly canSignIn: boolean;
}

export interface CatalogTenner {
  readonly title: string;
  readonly category: Category;
  readonly estimatedMinutes: number;
  readonly assignedTo: UserId;
  readonly frequencyUnit: FrequencyUnit;
  readonly frequencyInterval: number;
  /** Weekday-bound weeks; null = completion-based. */
  readonly weekdays: readonly Weekday[] | null;
  /**
   * First due date: with weekdays, the n-th matching weekday from today (0 = the next one, today included), so the
   * rotation catalogs start one Tenner per week; without weekdays, today.
   */
  readonly slot: number;
}

/** Members the catalog adds; existing IDs are left unchanged. */
export const CATALOG_MEMBERS: readonly CatalogMember[] = [{ userId: "HAUSHALTSHILFE", displayName: "Haushaltshilfe", color: "TEAL", canSignIn: false }];

const daily = (title: string, estimatedMinutes: number, assignedTo: UserId, interval = 1): CatalogTenner => ({
  title,
  category: "HOUSEHOLD",
  estimatedMinutes,
  assignedTo,
  frequencyUnit: "DAY",
  frequencyInterval: interval,
  weekdays: null,
  slot: 0,
});

const weekly = (title: string, estimatedMinutes: number, assignedTo: UserId, weekday: Weekday | null, category: Category = "HOUSEHOLD"): CatalogTenner => ({
  title,
  category,
  estimatedMinutes,
  assignedTo,
  frequencyUnit: "WEEK",
  frequencyInterval: 1,
  weekdays: weekday ? [weekday] : null,
  slot: 0,
});

/** One Tenner per week on `weekday`, each repeating every `weeks` weeks (12-week and 26-week rotations). */
const rotation = (weeks: number, weekday: Weekday, entries: readonly (readonly [string, Category])[]): CatalogTenner[] =>
  entries.map(([title, category], slot) => ({
    title,
    category,
    estimatedMinutes: 10,
    assignedTo: "STEFAN",
    frequencyUnit: "WEEK",
    frequencyInterval: weeks,
    weekdays: [weekday],
    slot,
  }));

export const CATALOG_TENNERS: readonly CatalogTenner[] = [
  // Daily
  daily("Saugroboter Erdgeschoss", 1, "STEFAN"),
  daily("Saugroboter Obergeschoss", 1, "STEFAN"),
  daily("Küche abends klar machen", 10, "STEFAN"),
  daily("Wäsche-Runde", 10, "JULIA"),
  // Every 3 days
  daily("Müll rausbringen", 5, "STEFAN", 3),
  // Weekly (Thursday = joker day, Sunday free)
  weekly("Kleines Bad", 10, "STEFAN", "MON"),
  weekly("Spiegel putzen", 5, "STEFAN", "MON"),
  weekly("Obergeschoss abstauben", 10, "STEFAN", "TUE"),
  weekly("Bad oben", 10, "JULIA", "TUE"),
  weekly("Erdgeschoss abstauben", 10, "STEFAN", "WED"),
  // Household help, weekly without a fixed day
  weekly("Böden gründlich reinigen", 60, "HAUSHALTSHILFE", null),
  weekly("Staub wischen", 60, "HAUSHALTSHILFE", null),
  // 12-week rotation, Fridays
  ...rotation(12, "FRI", [
    ["Kühlschrank reinigen", "HOUSEHOLD"],
    ["Backofen reinigen", "HOUSEHOLD"],
    ["Bad ausmisten", "HOUSEHOLD"],
    ["Kinderzimmer ausmisten", "FAMILY"],
    ["Schlafzimmer ausmisten", "HOUSEHOLD"],
    ["Kleiderschrank ausmisten", "HOUSEHOLD"],
    ["Keller ausmisten", "HOME"],
    ["Abstellraum ausmisten", "HOME"],
    ["Vorratsschrank reinigen", "HOUSEHOLD"],
    ["Eingangsbereich reinigen", "HOUSEHOLD"],
    ["Unterlagen sortieren", "FINANCE"],
    ["Haushalt-Wartung prüfen", "HOME"],
  ]),
  // 26-week rotation, Saturdays
  ...rotation(26, "SAT", [
    ["Fenster Teil 1", "HOUSEHOLD"],
    ["Fenster Teil 2", "HOUSEHOLD"],
    ["Fenster Teil 3", "HOUSEHOLD"],
    ["Fenster Teil 4", "HOUSEHOLD"],
    ["Rauchmelder prüfen", "HOME"],
    ["Küche Grundreinigung", "HOUSEHOLD"],
    ["Bad Grundreinigung", "HOUSEHOLD"],
    ["Garage und Keller warten", "HOME"],
    ["Außenbereich reinigen", "HOME"],
    ["Saisonal umräumen", "HOUSEHOLD"],
  ]),
];
