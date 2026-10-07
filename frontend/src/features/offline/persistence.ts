/**
 * Offline read cache (MOBILE-003): the TanStack Query cache of what the dashboard, the Tenner list and the detail
 * pages show is persisted in localStorage, so the last known state is visible without a connection.
 * Max age 7 days; cleared on logout; discarded when the user or the app build changes.
 */

import type { Query, QueryClient } from "@tanstack/react-query";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

export const OFFLINE_CACHE_KEY = "tenner.offlineCache";
export const OFFLINE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Query key roots that are persisted: only what the offline pages show (privacy: no analytics, settings, Alexa, no food
 * profile). Meal plans since FOOD-009, shopping lists since FOOD-014.
 */
export const PERSISTED_QUERY_ROOTS: readonly string[] = [
  "dashboard",
  "tenners",
  "history",
  "members",
  "categories",
  "mealPlans",
  "shoppingLists",
];

/** Storage subset used by the persister (window.localStorage in the app). */
export type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Only successful queries below the persisted roots. */
export function shouldPersistQuery(query: Pick<Query, "queryKey" | "state">): boolean {
  const root = query.queryKey[0];
  return query.state.status === "success" && typeof root === "string" && PERSISTED_QUERY_ROOTS.includes(root);
}

/**
 * A persister on a synchronous Web Storage. Write failures (quota, private mode) are ignored: the cache is a
 * convenience, the app works without it.
 */
export function createStoragePersister(storage: CacheStorage, key: string = OFFLINE_CACHE_KEY): Persister {
  return {
    persistClient: (client: PersistedClient) => {
      try {
        storage.setItem(key, JSON.stringify(client));
      } catch {
        // Not persisted: the next change tries again.
      }
    },
    restoreClient: () => {
      try {
        const stored = storage.getItem(key);
        return stored ? (JSON.parse(stored) as PersistedClient) : undefined;
      } catch {
        return undefined;
      }
    },
    removeClient: () => {
      try {
        storage.removeItem(key);
      } catch {
        // Nothing stored.
      }
    },
  };
}

/** Cache version: a new build or another user discards the stored cache. */
export function cacheBuster(build: string, userId: string): string {
  return `${build}:${userId}`;
}

/** Logout (MOBILE-003): empty the in-memory cache first (that persists an empty client), then delete the storage. */
export function clearOfflineCache(
  queryClient: QueryClient,
  storage: CacheStorage,
  key: string = OFFLINE_CACHE_KEY,
): void {
  queryClient.clear();
  try {
    storage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}
