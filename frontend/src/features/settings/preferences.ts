/**
 * Personal preferences (FRONTEND-008): default assignee, dashboard sections and theme. Stored per device in
 * localStorage. Household-wide defaults (category, minutes, frequency) are server-side since HOUSEHOLD-ADMIN-003. The model is versioned and validated, so it can later be exported or synced
 * (export itself is out of scope).
 */

import { z } from "zod";
import { CATEGORY_ID_PATTERN, USER_ID_PATTERN, type UserId } from "../../types/domain";

export const PREFERENCES_STORAGE_KEY = "tenner.preferences";
export const PREFERENCES_VERSION = 1;

export const THEME_MODES = ["SYSTEM", "LIGHT", "DARK"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** "SELF" = the signed-in household member (the current user comes from the login, SECURITY-003). */
export type DefaultAssignee = UserId | "SELF";

export const MINUTES_RANGE = { min: 1, max: 480 } as const;
export const FREQUENCY_RANGE = { min: 1, max: 3650 } as const;

export interface UserPreferences {
  readonly defaultAssignedTo: DefaultAssignee;
  readonly showUpcoming: boolean;
  readonly showCategorySummary: boolean;
  readonly showUserSummary: boolean;
  readonly showRecentActivity: boolean;
  readonly theme: ThemeMode;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultAssignedTo: "SELF",
  showUpcoming: true,
  showCategorySummary: true,
  showUserSummary: true,
  showRecentActivity: true,
  theme: "SYSTEM",
};

const integerIn = (range: { min: number; max: number }) => z.number().int().min(range.min).max(range.max);

/** Field schemas; invalid stored fields fall back to their default individually. */
const FIELD_SCHEMAS: { readonly [K in keyof UserPreferences]: z.ZodType<UserPreferences[K]> } = {
  defaultAssignedTo: z.union([z.literal("SELF"), z.string().regex(USER_ID_PATTERN)]),
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

/** Quick Add defaults stored on this device before HOUSEHOLD-ADMIN-003 (only values that differ from the built-ins). */
export interface LegacyTennerDefaults {
  readonly category: string;
  readonly estimatedMinutes: number;
  readonly frequencyDays: number;
}

const LEGACY_BUILT_INS: LegacyTennerDefaults = { category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14 };

/**
 * The device's old Quick Add defaults, or null if none were customized. Used once to offer moving them to the
 * household settings; `savePreferences` drops them because they are no longer part of the model.
 */
export function loadLegacyTennerDefaults(
  storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage(),
): LegacyTennerDefaults | null {
  try {
    const text = storage?.getItem(PREFERENCES_STORAGE_KEY);
    if (!text) return null;
    const stored = (JSON.parse(text) as { preferences?: Record<string, unknown> }).preferences ?? {};
    const category = z.string().regex(CATEGORY_ID_PATTERN).safeParse(stored.defaultCategory);
    const minutes = integerIn(MINUTES_RANGE).safeParse(stored.defaultEstimatedMinutes);
    const frequency = integerIn(FREQUENCY_RANGE).safeParse(stored.defaultFrequencyDays);
    if (!category.success && !minutes.success && !frequency.success) return null;
    const legacy: LegacyTennerDefaults = {
      category: category.success ? category.data : LEGACY_BUILT_INS.category,
      estimatedMinutes: minutes.success ? minutes.data : LEGACY_BUILT_INS.estimatedMinutes,
      frequencyDays: frequency.success ? frequency.data : LEGACY_BUILT_INS.frequencyDays,
    };
    const customized =
      legacy.category !== LEGACY_BUILT_INS.category ||
      legacy.estimatedMinutes !== LEGACY_BUILT_INS.estimatedMinutes ||
      legacy.frequencyDays !== LEGACY_BUILT_INS.frequencyDays;
    return customized ? legacy : null;
  } catch {
    return null;
  }
}
