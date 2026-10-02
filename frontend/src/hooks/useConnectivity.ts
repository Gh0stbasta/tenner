/** Connectivity hooks (UX-005). */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { isApiError } from "../api/errors";

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** navigator.onLine, updated on online/offline events. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine);
}

/** True while reads fail with transient errors (network, 429, 5xx); false after the next successful read. */
export function useApiUnreachable(): boolean {
  const queryClient = useQueryClient();
  const [unreachable, setUnreachable] = useState(false);
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "updated") return;
        const { action } = event;
        if (
          (action.type === "failed" || action.type === "error") &&
          isApiError(action.error) &&
          action.error.isTransient
        ) {
          setUnreachable(true);
        } else if (action.type === "success") {
          setUnreachable(false);
        }
      }),
    [queryClient],
  );
  return unreachable;
}
