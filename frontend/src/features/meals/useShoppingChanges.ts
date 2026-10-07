/**
 * Changes of the shopping list (FOOD-014): applied at once on the device, queued in localStorage and sent when online
 * (also after a reload). The page shows the server list with the queued changes applied, so a refetch never undoes a
 * tick that is still on its way.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import { queryKeys } from "../../api/queryKeys";
import { useNotify } from "../../components/NotificationProvider";
import { useOnline } from "../../hooks/useConnectivity";
import { sendShoppingOperations, type ShoppingList, type ShoppingOperation } from "./api";
import { applyShoppingOperations } from "./shopping";
import { flushShoppingQueue, ShoppingQueue } from "./shoppingQueue";

const SHOPPING_LISTS_ROOT = queryKeys.shoppingList("")[0];

/** Network, server, rate limit, expired login or a parallel change that outlasted the server's retries. */
const isRetryable = (error: unknown): boolean =>
  !isApiError(error) || error.isTransient || error.status === 401 || error.code === "CONCURRENT_MODIFICATION";

export function useShoppingChanges(list: ShoppingList | undefined) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const online = useOnline();
  const queue = useMemo(() => new ShoppingQueue(window.localStorage), []);
  const queued = useSyncExternalStore(queue.subscribe, queue.list);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      await flushShoppingQueue(
        queue,
        sendShoppingOperations,
        (weekStart, result) => {
          for (const [key, data] of queryClient.getQueriesData<ShoppingList>({ queryKey: [SHOPPING_LISTS_ROOT] })) {
            if (data?.weekStart === weekStart) queryClient.setQueryData(key, result);
          }
        },
        (error) => {
          notify({
            message: `Änderung an der Einkaufsliste nicht gespeichert. ${errorMessage(error)}`,
            severity: "error",
          });
          void queryClient.invalidateQueries({ queryKey: [SHOPPING_LISTS_ROOT] });
        },
        isRetryable,
      );
    } finally {
      flushing.current = false;
    }
  }, [queue, queryClient, notify]);

  useEffect(() => {
    if (online && queued.length > 0) void flush();
  }, [online, queued.length, flush]);

  const change = useCallback(
    (operations: readonly ShoppingOperation[]) => {
      if (!list) return;
      queue.add(operations.map((operation) => ({ weekStart: list.weekStart, operation })));
    },
    [list, queue],
  );

  const items = useMemo(
    () =>
      list
        ? applyShoppingOperations(
            list.items,
            queued.filter((entry) => entry.weekStart === list.weekStart).map((entry) => entry.operation),
          )
        : [],
    [list, queued],
  );

  return { items, change, pending: queued.length };
}
