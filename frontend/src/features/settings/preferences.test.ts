import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  loadLegacyTennerDefaults,
  loadPreferences,
  parsePreferences,
  PREFERENCES_STORAGE_KEY,
  resolveAssignee,
  savePreferences,
} from "./preferences";

function memoryStorage(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[PREFERENCES_STORAGE_KEY, initial]]);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe("preferences model", () => {
  it("settings load: defaults when nothing is stored", () => {
    expect(loadPreferences(memoryStorage())).toEqual(DEFAULT_PREFERENCES);
  });

  it("settings save and load round trip (versioned envelope)", () => {
    const storage = memoryStorage();
    const changed = {
      ...DEFAULT_PREFERENCES,
      defaultAssignedTo: "JULIA",
      theme: "DARK" as const,
      showUpcoming: false,
    };
    expect(savePreferences(changed, storage)).toBe(true);
    expect(JSON.parse(storage.data.get(PREFERENCES_STORAGE_KEY) ?? "")).toMatchObject({
      version: 1,
      preferences: { theme: "DARK" },
    });
    expect(loadPreferences(storage)).toEqual(changed);
  });

  it("keeps valid fields and replaces invalid ones with defaults", () => {
    expect(
      parsePreferences({
        defaultAssignedTo: "lena",
        showUpcoming: false,
        theme: "LIGHT",
        defaultEstimatedMinutes: 30,
        extra: 1,
      }),
    ).toEqual({ ...DEFAULT_PREFERENCES, showUpcoming: false, theme: "LIGHT" });
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("survives broken JSON and blocked storage", () => {
    expect(loadPreferences(memoryStorage("{broken"))).toEqual(DEFAULT_PREFERENCES);
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    expect(loadPreferences(throwing)).toEqual(DEFAULT_PREFERENCES);
    expect(savePreferences(DEFAULT_PREFERENCES, throwing)).toBe(false);
  });

  it("resolves the default assignee", () => {
    expect(resolveAssignee("SELF", "JULIA")).toBe("JULIA");
    expect(resolveAssignee("STEFAN", "JULIA")).toBe("STEFAN");
  });

  it("reads Quick Add defaults stored before HOUSEHOLD-ADMIN-003 for the migration offer", () => {
    const stored = (preferences: Record<string, unknown>) => memoryStorage(JSON.stringify({ version: 1, preferences }));
    expect(
      loadLegacyTennerDefaults(
        stored({ defaultCategory: "FITNESS", defaultEstimatedMinutes: 25, defaultFrequencyDays: 7 }),
      ),
    ).toEqual({
      category: "FITNESS",
      estimatedMinutes: 25,
      frequencyDays: 7,
    });
    expect(loadLegacyTennerDefaults(stored({ defaultEstimatedMinutes: 25 }))).toEqual({
      category: "HOUSEHOLD",
      estimatedMinutes: 25,
      frequencyDays: 14,
    });
    expect(
      loadLegacyTennerDefaults(
        stored({ defaultCategory: "HOUSEHOLD", defaultEstimatedMinutes: 10, defaultFrequencyDays: 14 }),
      ),
    ).toBeNull();
    expect(loadLegacyTennerDefaults(stored({ theme: "DARK" }))).toBeNull();
    expect(loadLegacyTennerDefaults(memoryStorage("{broken"))).toBeNull();
    expect(loadLegacyTennerDefaults(memoryStorage())).toBeNull();
  });

  it("drops the old fields when the preferences are saved again", () => {
    const storage = memoryStorage(
      JSON.stringify({ version: 1, preferences: { defaultCategory: "FITNESS", theme: "DARK" } }),
    );
    savePreferences(loadPreferences(storage), storage);
    expect(loadLegacyTennerDefaults(storage)).toBeNull();
    expect(loadPreferences(storage).theme).toBe("DARK");
  });

  it("uses window.localStorage by default", () => {
    savePreferences({ ...DEFAULT_PREFERENCES, theme: "LIGHT" });
    expect(loadPreferences().theme).toBe("LIGHT");
  });
});
