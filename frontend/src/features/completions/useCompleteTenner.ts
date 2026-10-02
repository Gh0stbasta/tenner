/** Complete a Tenner and refresh everything that shows it (FRONTEND-002). */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/queryKeys";
import { completeTenner } from "./api";
import { useCurrentUser } from "./useCurrentUser";

export interface CompleteRequest {
  readonly tennerId: string;
  /** Default effort: the Tenner's estimated minutes. */
  readonly estimatedMinutes: number;
}

export function useCompleteTenner() {
  const queryClient = useQueryClient();
  const completedBy = useCurrentUser();
  return useMutation({
    mutationFn: ({ tennerId, estimatedMinutes }: CompleteRequest) =>
      completeTenner({ tennerId, completedBy, actualMinutes: estimatedMinutes, idempotencyKey: crypto.randomUUID() }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenners }),
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      ]),
  });
}
