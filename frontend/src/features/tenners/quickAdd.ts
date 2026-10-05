/** Quick Add rules (FRONTEND-006): defaults, keyword-based category suggestions, duplicate detection. */

import type { Category } from "../../types/domain";
import type { Tenner } from "./schemas";

/** Built-in defaults; the user preferences (FRONTEND-008) override them at runtime. */
export const QUICK_ADD_DEFAULTS = {
  category: "HOUSEHOLD",
  estimatedMinutes: 10,
  frequencyDays: 14,
} as const satisfies {
  category: Category;
  estimatedMinutes: number;
  frequencyDays: number;
};

/** Keywords (German and English, lowercase) per category. The first matching category wins. */
export const CATEGORY_KEYWORDS: readonly (readonly [Category, readonly string[]])[] = [
  [
    "FITNESS",
    [
      "ride",
      "zwift",
      "bike",
      "cycling",
      "rad",
      "laufen",
      "joggen",
      "lauf",
      "mobility",
      "yoga",
      "training",
      "workout",
      "gym",
      "schwimmen",
      "dehnen",
    ],
  ],
  ["FAMILY", ["date", "family", "kids", "henry", "hugo", "harper", "familie", "kinder", "oma", "opa"]],
  ["FINANCE", ["steuer", "rechnung", "konto", "bank", "versicherung", "budget", "finanz"]],
  ["HOME", ["garten", "rasen", "hecke", "garage", "keller", "dach", "reparieren", "auto"]],
  [
    "HOUSEHOLD",
    [
      "window",
      "office",
      "vacuum",
      "clean",
      "fenster",
      "büro",
      "saugen",
      "putzen",
      "wischen",
      "spülen",
      "wäsche",
      "aufräumen",
      "staub",
      "bad",
      "küche",
    ],
  ],
  ["PERSONAL", ["lesen", "arzt", "friseur", "zahnarzt", "meditation"]],
];

/** Suggested category for a title, or undefined if no keyword matches. */
export function suggestCategory(title: string): Category | undefined {
  const words = title
    .toLocaleLowerCase("de-DE")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const text = words.join(" ");
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => words.includes(keyword) || (keyword.length >= 5 && text.includes(keyword))))
      return category;
  }
  return undefined;
}

export function normalizeTitle(title: string): string {
  return title.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
}

/** An existing Tenner whose title equals or contains the new title (or vice versa). */
export function findSimilarTenner(title: string, existing: readonly Tenner[]): Tenner | undefined {
  const candidate = normalizeTitle(title);
  if (!candidate) return undefined;
  return existing.find((tenner) => {
    const other = normalizeTitle(tenner.title);
    if (other === candidate) return true;
    const [shorter, longer] = other.length < candidate.length ? [other, candidate] : [candidate, other];
    return shorter.length >= 4 && longer.includes(shorter);
  });
}
