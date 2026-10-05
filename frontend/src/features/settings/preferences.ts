/**
 * User preferences (FRONTEND-008): defaults for Quick Add and new Tenners, dashboard sections and theme.
 * Stored per device in localStorage. The model is versioned and validated, so it can later be exported or synced
 * (export itself is out of scope).
 */

import { z } from "zod";
import { CATEGORIES, USER_ID_PATTERN, type Category, type UserId } from "../../types/domain";

export const PREFERENCES_STORAGE_KEY = "tenner.preferences";
export const PREFERENCES_VERSION = 1;

export const THEME_MODES = ["SYSTEM", "LIGHT", "DARK"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** "SELF" = the signed-in household member (the current user comes from the login, SECURITY-003). */
export type DefaultAssignee = UserId | "SELF";

export const MINUTES_RANGE = { min: 1, max: 480 } as const;
export const FREQUENCY_RANGE = { min: 1, max: 3650 } as const;

export interface UserPreferences {
  readonly defaultCategory: Category;
  readonly defaultAssignedTo: DefaultAssignee;
  readonly defaultEstimatedMinutes: number;
  readonly defaultFrequencyDays: number;
  readonly showUpcoming: boolean;
  readonly showCategorySummary: boolean;
  readonly showUserSummary: boolean;
  readonly showRecentActivity: boolean;
  readonly theme: ThemeMode;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultCategory: "HOUSEHOLD",
  defaultAssignedTo: "SELF",
  defaultEstimatedMinutes: 10,
  defaultFrequencyDays: 14,
  showUpcoming: true,
  showCategorySummary: true,
  showUserSummary: true,
  showRecentActivity: true,
  theme: "SYSTEM",
};

const integerIn = (range: { min: number; max: number }) => z.number().int().min(range.min).max(range.max);

/** Field schemas; invalid stored fields fall back to their default individually. */
const FIELD_SCHEMAS: { readonly [K in keyof UserPreferences]: z.ZodType<UserPreferences[K]> } = {
  defaultCategory: z.enum(CATEGORIES),
  defaultAssignedTo: z.union([z.literal("SELF"), z.string().regex(USER_ID_PATTERN)]),
  defaultEstimatedMinutes: integerIn(MINUTES_RANGE),
  defaultFrequencyDays: integerIn(FREQUENCY_RANGE),
  showUpcoming: z.boolean(),
  showCategorySummary: z.boolean(),
  showUserSummary: z.boolean(),
  showRecentActivity: z.boolean(),
  theme: z.enum(THEME_MODES),
};

/** Merge untrusted stored data over the defaults, keeping only valid fields. */
export function parsePreferences(raw: unknown): UserPreferences {
  if (typeof raw !== "object" || raw === null) return DEFAULT_PREFERENCES;
  const stored = raw as Record<string, unknown>;
  const result: Record<string, unknown> = { ...DEFAULT_PREFERENCES };
  for (const key of Object.keys(FIELD_SCHEMAS) as (keyof UserPreferences)[]) {
    const parsed = FIELD_SCHEMAS[key].safeParse(stored[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return result as unknown as UserPreferences;
}

/** Read the stored preferences; any storage or JSON problem yields the defaults. */
export function loadPreferences(storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage()): UserPreferences {
  try {
    const text = storage?.getItem(PREFERENCES_STORAGE_KEY);
    if (!text) return DEFAULT_PREFERENCES;
    const data = JSON.parse(text) as { preferences?: unknown };
    return parsePreferences(data.preferences);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Persist the preferences (versioned envelope). Returns false if the browser blocks storage. */
export function savePreferences(
  preferences: UserPreferences,
  storage: Pick<Storage, "setItem"> | undefined = safeLocalStorage(),
): boolean {
  try {
    storage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ version: PREFERENCES_VERSION, preferences }));
    return storage !== undefined;
  } catch {
    return false;
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The household member new Tenners are assigned to by default. */
export function resolveAssignee(preference: DefaultAssignee, currentUser: UserId): UserId {
  return preference === "SELF" ? currentUser : preference;
}
