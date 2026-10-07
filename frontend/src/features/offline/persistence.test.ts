import { QueryClient } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { describe, expect, it } from "vitest";
import {
  cacheBuster,
  clearOfflineCache,
  createStoragePersister,
  OFFLINE_CACHE_KEY,
  shouldPersistQuery,
  type CacheStorage,
} from "./persistence";

function memoryStorage(): CacheStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const failingStorage: CacheStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const client: PersistedClient = { timestamp: 1, buster: "b", clientState: { queries: [], mutations: [] } };

describe("offline cache persistence (MOBILE-003)", () => {
  it("persists only successful queries of the offline pages", () => {
    const state = (status: "success" | "error") => ({ status }) as never;
    expect(shouldPersistQuery({ queryKey: ["dashboard"], state: state("success") })).toBe(true);
    expect(shouldPersistQuery({ queryKey: ["tenners", "detail", "t1"], state: state("success") })).toBe(true);
    expect(shouldPersistQuery({ queryKey: ["history", "recent"], state: state("success") })).toBe(true);
    expect(shouldPersistQuery({ queryKey: ["dashboard"], state: state("error") })).toBe(false);
    expect(shouldPersistQuery({ queryKey: ["analytics", "summary", {}], state: state("success") })).toBe(false);
    expect(shouldPersistQuery({ queryKey: ["household", "alexa"], state: state("success") })).toBe(false);
    // FOOD-009: meal plans offline, but not the food profile with allergies.
    expect(shouldPersistQuery({ queryKey: ["mealPlans", "current"], state: state("success") })).toBe(true);
    expect(shouldPersistQuery({ queryKey: ["meals", "profile"], state: state("success") })).toBe(false);
  });

  it("stores, restores and removes the client", async () => {
    const storage = memoryStorage();
    const persister = createStoragePersister(storage);
    await persister.persistClient(client);
    expect(storage.data.has(OFFLINE_CACHE_KEY)).toBe(true);
    expect(await persister.restoreClient()).toEqual(client);
    await persister.removeClient();
    expect(await persister.restoreClient()).toBeUndefined();
  });

  it("ignores storage failures and corrupt entries", async () => {
    const persister = createStoragePersister(failingStorage);
    await expect(Promise.resolve(persister.persistClient(client))).resolves.toBeUndefined();
    expect(await persister.restoreClient()).toBeUndefined();
    await expect(Promise.resolve(persister.removeClient())).resolves.toBeUndefined();
    const corrupt = memoryStorage();
    corrupt.setItem(OFFLINE_CACHE_KEY, "{not json");
    expect(await createStoragePersister(corrupt).restoreClient()).toBeUndefined();
  });

  it("busts the cache per build and user", () => {
    expect(cacheBuster("abc", "STEFAN")).toBe("abc:STEFAN");
    expect(cacheBuster("abc", "STEFAN")).not.toBe(cacheBuster("abc", "JULIA"));
  });

  it("logout clears memory and storage", () => {
    const storage = memoryStorage();
    storage.setItem(OFFLINE_CACHE_KEY, "x");
    const queryClient = new QueryClient();
    queryClient.setQueryData(["dashboard"], { ok: true });
    clearOfflineCache(queryClient, storage);
    expect(queryClient.getQueryData(["dashboard"])).toBeUndefined();
    expect(storage.data.has(OFFLINE_CACHE_KEY)).toBe(false);
    expect(() => clearOfflineCache(queryClient, failingStorage)).not.toThrow();
  });
});
