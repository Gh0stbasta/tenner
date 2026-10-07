/** Age of the data on screen (MOBILE-003): the oldest update time of the queries the current page observes. */

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

/** Oldest dataUpdatedAt (epoch ms) of observed queries with data; undefined when nothing is shown. */
export function oldestShownUpdate(queryClient: QueryClient): number | undefined {
  const times = queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.getObserversCount() > 0 && query.state.dataUpdatedAt > 0)
    .map((query) => query.state.dataUpdatedAt);
  return times.length > 0 ? Math.min(...times) : undefined;
}

export function useDataAge(): number | undefined {
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
    [queryClient],
  );
  return useSyncExternalStore(subscribe, () => oldestShownUpdate(queryClient));
}
