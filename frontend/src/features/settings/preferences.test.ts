import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
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
      defaultCategory: "FITNESS" as const,
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
        defaultEstimatedMinutes: 30,
        defaultFrequencyDays: 99999,
        defaultCategory: "garden",
        theme: "LIGHT",
        extra: 1,
      }),
    ).toEqual({ ...DEFAULT_PREFERENCES, defaultEstimatedMinutes: 30, theme: "LIGHT" });
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences({ defaultEstimatedMinutes: 2.5 }).defaultEstimatedMinutes).toBe(10);
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

  it("uses window.localStorage by default", () => {
    savePreferences({ ...DEFAULT_PREFERENCES, theme: "LIGHT" });
    expect(loadPreferences().theme).toBe("LIGHT");
  });
});
