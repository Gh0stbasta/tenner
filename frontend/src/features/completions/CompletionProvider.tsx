/**
 * Completion workflow (FRONTEND-002/007), provided at app level so it survives the optimistic removal of
 * the card that started it: optimistic dashboard update, success snackbar with a 10-second undo,
 * retries with the same Idempotency-Key, refresh of dashboard, lists and history.
 * Offline (MOBILE-004) a completion goes into the device queue and is replayed when the connection returns.
 */

import { useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import { queryKeys } from "../../api/queryKeys";
import { useNotify } from "../../components/NotificationProvider";
import { trackEvent } from "../../utils/telemetry";
import type { Dashboard } from "../dashboard/api";
import { completeTenner, undoCompletion } from "./api";
import { useCurrentUser } from "./CurrentUserProvider";
import { CompletionQueue, syncQueue, type QueuedCompletion, type SyncReport } from "../offline/completionQueue";
import type { CacheStorage } from "../offline/persistence";
import { removeFromDashboard } from "./optimistic";

export const UNDO_WINDOW_MS = 10_000;
/** While completions wait and the device is online, sync is retried at this interval (MOBILE-004). */
export const OFFLINE_SYNC_INTERVAL_MS = 60_000;
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
  /** Offline completions not yet synced, oldest first (MOBILE-004). */
  readonly pending: readonly QueuedCompletion[];
}

const CompletionContext = createContext<CompletionContextValue | null>(null);

type Keyed<T> = T & { readonly idempotencyKey: string };
/** The action time travels with the request, so a network failure can still queue it (MOBILE-004). */
type Timed<T> = Keyed<T> & { readonly completedAt: string };

function syncMessage({ synced, dropped }: SyncReport): string {
  const parts: string[] = [];
  if (synced.length === 1) parts.push(`✅ Offline-Erledigung „${synced[0]?.title ?? ""}“ übertragen.`);
  if (synced.length > 1) parts.push(`✅ ${synced.length} Offline-Erledigungen übertragen.`);
  for (const { item, message } of dropped) parts.push(`„${item.title}“ nicht übernommen: ${message}`);
  return parts.join(" ");
}

export interface CompletionProviderProps {
  readonly children: ReactNode;
  /** Storage of the offline queue; default: window.localStorage. */
  readonly queueStorage?: CacheStorage;
}

export function CompletionProvider({ children, queueStorage = window.localStorage }: CompletionProviderProps) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const notify = useNotify();
  const queue = useMemo(() => new CompletionQueue(queueStorage), [queueStorage]);
  const pending = useSyncExternalStore(queue.subscribe, queue.list);
  const syncing = useRef(false);

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

  /** Removes the Tenner from the cached dashboard; returns the previous dashboard for a rollback. */
  const removeOptimistically = useCallback(
    (tennerId: string) => {
      const previous = queryClient.getQueryData<Dashboard>(queryKeys.dashboard);
      if (previous) queryClient.setQueryData(queryKeys.dashboard, removeFromDashboard(previous, tennerId));
      return previous;
    },
    [queryClient],
  );

  /** MOBILE-004: store the completion on the device; the snackbar's undo takes it out of the queue again. */
  const completeOffline = useCallback(
    (request: Timed<CompleteRequest>, previous?: Dashboard) => {
      const item: QueuedCompletion = {
        tennerId: request.tennerId,
        title: request.title,
        completedBy: user,
        completedAt: request.completedAt,
        idempotencyKey: request.idempotencyKey,
      };
      if (!queue.add(item)) {
        notify({ message: `„${request.title}“ ist schon zum Übertragen vorgemerkt.`, severity: "info" });
        return;
      }
      const before = previous ?? removeOptimistically(request.tennerId);
      trackEvent("TennerCompletedOffline", { tennerId: request.tennerId, completedBy: user });
      notify({
        message: `📴 „${request.title}“ offline erledigt. Wird übertragen, sobald du online bist.`,
        durationMs: UNDO_WINDOW_MS,
        action: {
          label: "Rückgängig",
          onClick: () => {
            if (queue.remove(item.idempotencyKey) && before) queryClient.setQueryData(queryKeys.dashboard, before);
          },
        },
      });
    },
    [notify, queryClient, queue, removeOptimistically, user],
  );

  const completeMutation = useMutation({
    mutationKey: COMPLETE_KEY,
    // No actualMinutes: the server records the estimate as a default, so analytics can tell it from a
    // user-reported value (ANALYTICS-005).
    mutationFn: ({ tennerId, idempotencyKey }: Timed<CompleteRequest>) =>
      completeTenner({ tennerId, completedBy: user, idempotencyKey }),
    onMutate: async ({ tennerId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboard });
      return { previous: removeOptimistically(tennerId) };
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
      // MOBILE-004: no response at all (connection dropped) → keep the optimistic state and queue it.
      if (isApiError(error) && error.status === 0) {
        completeOffline(request, context?.previous);
        return;
      }
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

  /** Replays the offline queue (MOBILE-004); one run at a time. */
  const sync = useCallback(async () => {
    if (syncing.current || queue.list().length === 0 || !navigator.onLine) return;
    syncing.current = true;
    try {
      const report = await syncQueue(queue, (item, completedAt) =>
        completeTenner({
          tennerId: item.tennerId,
          completedBy: item.completedBy,
          idempotencyKey: item.idempotencyKey,
          completedAt,
        }),
      );
      report.synced.forEach((item) =>
        trackEvent("TennerCompleted", { tennerId: item.tennerId, completedBy: item.completedBy, offline: true }),
      );
      if (report.synced.length + report.dropped.length > 0) {
        notify({ message: syncMessage(report), severity: report.dropped.length > 0 ? "error" : "success" });
        await invalidate();
      }
    } finally {
      syncing.current = false;
    }
  }, [invalidate, notify, queue]);

  useEffect(() => {
    void sync();
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sync]);

  // Server or connection problems keep entries queued: retry while there are any.
  const hasPending = pending.length > 0;
  useEffect(() => {
    if (!hasPending) return;
    const timer = window.setInterval(() => void sync(), OFFLINE_SYNC_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasPending, sync]);

  const { mutate: mutateComplete } = completeMutation;
  const { mutate: mutateUndo } = undoMutation;
  const value = useMemo<CompletionContextValue>(
    () => ({
      complete: (request) => {
        // Short haptic feedback where supported (MOBILE-005).
        if ("vibrate" in navigator) navigator.vibrate(15);
        const timed = { ...request, idempotencyKey: crypto.randomUUID(), completedAt: new Date().toISOString() };
        if (navigator.onLine) mutateComplete(timed);
        else completeOffline(timed);
      },
      undo: (request) => mutateUndo({ ...request, idempotencyKey: crypto.randomUUID() }),
      isCompleting: (tennerId) => pendingIds.includes(tennerId),
      pending,
    }),
    [completeOffline, mutateComplete, mutateUndo, pending, pendingIds],
  );

  return <CompletionContext.Provider value={value}>{children}</CompletionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs to its provider
export function useCompletion(): CompletionContextValue {
  const context = useContext(CompletionContext);
  if (!context) throw new Error("useCompletion must be used inside CompletionProvider.");
  return context;
}

const NO_PENDING: readonly string[] = [];

/** Tenner IDs with an offline completion waiting for sync; empty outside the provider (MOBILE-004). */
// eslint-disable-next-line react-refresh/only-export-components -- hook belongs to its provider
export function usePendingCompletionIds(): readonly string[] {
  const pending = useContext(CompletionContext)?.pending;
  return useMemo(() => (pending ? pending.map((item) => item.tennerId) : NO_PENDING), [pending]);
}
