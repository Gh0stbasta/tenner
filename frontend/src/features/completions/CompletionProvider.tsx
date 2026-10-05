/**
 * Completion workflow (FRONTEND-002/007), provided at app level so it survives the optimistic removal of
 * the card that started it: optimistic dashboard update, success snackbar with a 10-second undo,
 * retries with the same Idempotency-Key, refresh of dashboard, lists and history.
 */

import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { errorMessage } from "../../api/errorMessages";
import { queryKeys } from "../../api/queryKeys";
import { useNotify } from "../../components/NotificationProvider";
import { trackEvent } from "../../utils/telemetry";
import type { Dashboard } from "../dashboard/api";
import { completeTenner, undoCompletion } from "./api";
import { useCurrentUser } from "./CurrentUserProvider";
import { removeFromDashboard } from "./optimistic";

export const UNDO_WINDOW_MS = 10_000;
const COMPLETE_KEY = ["complete"] as const;

export interface CompleteRequest {
  readonly tennerId: string;
  readonly title: string;
}

export interface UndoRequest {
  readonly tennerId: string;
  readonly title: string;
}

interface CompletionContextValue {
  readonly complete: (request: CompleteRequest) => void;
  readonly undo: (request: UndoRequest) => void;
  readonly isCompleting: (tennerId: string) => boolean;
}

const CompletionContext = createContext<CompletionContextValue | null>(null);

type Keyed<T> = T & { readonly idempotencyKey: string };

export function CompletionProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const notify = useNotify();

  const invalidate = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenners }),
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      ]),
    [queryClient],
  );

  // Callbacks live in the mutation options, so they run for every mutation (also rapid, parallel ones).
  const undoMutation = useMutation({
    mutationFn: ({ tennerId, idempotencyKey }: Keyed<UndoRequest>) =>
      undoCompletion({ tennerId, revertedBy: user, idempotencyKey }),
    onSuccess: (_, request) => {
      trackEvent("CompletionUndone", { tennerId: request.tennerId });
      notify({ message: "↩ Erledigung zurückgenommen.", severity: "info" });
    },
    onError: (error, request) =>
      notify({
        message: `Rückgängig machen fehlgeschlagen. ${errorMessage(error)}`,
        severity: "error",
        action: { label: "Erneut versuchen", onClick: () => undoMutation.mutate(request) },
      }),
    onSettled: invalidate,
  });

  const completeMutation = useMutation({
    mutationKey: COMPLETE_KEY,
    // No actualMinutes: the server records the estimate as a default, so analytics can tell it from a
    // user-reported value (ANALYTICS-005).
    mutationFn: ({ tennerId, idempotencyKey }: Keyed<CompleteRequest>) =>
      completeTenner({ tennerId, completedBy: user, idempotencyKey }),
    onMutate: async ({ tennerId }) => {
      // Short haptic feedback where supported (MOBILE-005).
      if ("vibrate" in navigator) navigator.vibrate(15);
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboard });
      const previous = queryClient.getQueryData<Dashboard>(queryKeys.dashboard);
      if (previous) queryClient.setQueryData(queryKeys.dashboard, removeFromDashboard(previous, tennerId));
      return { previous };
    },
    onSuccess: (_, request) => {
      trackEvent("TennerCompleted", { tennerId: request.tennerId, completedBy: user });
      notify({
        message: `✅ „${request.title}“ erledigt.`,
        durationMs: UNDO_WINDOW_MS,
        action: {
          label: "Rückgängig",
          onClick: () =>
            undoMutation.mutate({
              tennerId: request.tennerId,
              title: request.title,
              idempotencyKey: crypto.randomUUID(),
            }),
        },
      });
    },
    onError: (error, request, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.dashboard, context.previous);
      notify({
        message: `„${request.title}“ konnte nicht erledigt werden. ${errorMessage(error)}`,
        severity: "error",
        // Same Idempotency-Key: a retry cannot complete the Tenner twice.
        action: { label: "Erneut versuchen", onClick: () => completeMutation.mutate(request) },
      });
    },
    onSettled: invalidate,
  });

  const pendingIds = useMutationState({
    filters: { mutationKey: COMPLETE_KEY, status: "pending" },
    select: (mutation) => (mutation.state.variables as Keyed<CompleteRequest> | undefined)?.tennerId,
  });

  const { mutate: mutateComplete } = completeMutation;
  const { mutate: mutateUndo } = undoMutation;
  const value = useMemo<CompletionContextValue>(
    () => ({
      complete: (request) => mutateComplete({ ...request, idempotencyKey: crypto.randomUUID() }),
      undo: (request) => mutateUndo({ ...request, idempotencyKey: crypto.randomUUID() }),
      isCompleting: (tennerId) => pendingIds.includes(tennerId),
    }),
    [mutateComplete, mutateUndo, pendingIds],
  );

  return <CompletionContext.Provider value={value}>{children}</CompletionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs to its provider
export function useCompletion(): CompletionContextValue {
  const context = useContext(CompletionContext);
  if (!context) throw new Error("useCompletion must be used inside CompletionProvider.");
  return context;
}
