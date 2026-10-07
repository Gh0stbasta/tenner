/** Persists the offline read cache for the logged-in member (MOBILE-003); mounted by the AuthGate. */

import { useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useMemo, type ReactNode } from "react";
import {
  cacheBuster,
  createStoragePersister,
  OFFLINE_CACHE_MAX_AGE_MS,
  shouldPersistQuery,
  type CacheStorage,
} from "./persistence";

export interface OfflineCacheProviderProps {
  readonly user: string;
  readonly children: ReactNode;
  /** Default: window.localStorage. */
  readonly storage?: CacheStorage;
  /** Default: the build id injected by Vite. */
  readonly build?: string;
}

export function OfflineCacheProvider({
  user,
  children,
  storage = window.localStorage,
  build = __APP_BUILD__,
}: OfflineCacheProviderProps) {
  const queryClient = useQueryClient();
  const persister = useMemo(() => createStoragePersister(storage), [storage]);
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: OFFLINE_CACHE_MAX_AGE_MS,
        buster: cacheBuster(build, user),
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
