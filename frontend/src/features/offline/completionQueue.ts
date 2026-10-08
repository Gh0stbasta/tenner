/**
 * Offline completion queue (MOBILE-004): completions made without a connection are stored on the device with their
 * time and Idempotency-Key and replayed in order when the connection returns.
 */

import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import type { UserId } from "../../types/domain";
import type { CacheStorage } from "./persistence";

export const OFFLINE_QUEUE_KEY = "tenner.offlineQueue";
/** A queued time further in the future than this (device clock changed) is rejected instead of clamped. */
export const MAX_CLOCK_SKEW_MS = 5 * 60_000;

export interface QueuedCompletion {
  readonly tennerId: string;
  readonly title: string;
  readonly completedBy: UserId;
  /** Device time of the action, UTC ISO timestamp. */
  readonly completedAt: string;
  /** Generated at action time: replays cannot complete the Tenner twice. */
  readonly idempotencyKey: string;
}

function readQueue(storage: CacheStorage, key: string): readonly QueuedCompletion[] {
  try {
    const stored = storage.getItem(key);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? (parsed as QueuedCompletion[]) : [];
  } catch {
    return [];
  }
}

/** Queue in Web Storage with change notifications (for useSyncExternalStore). */
export class CompletionQueue {
  private items: readonly QueuedCompletion[];
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storage: CacheStorage,
    private readonly key: string = OFFLINE_QUEUE_KEY,
  ) {
    this.items = readQueue(storage, key);
  }

  /** Current entries, oldest first; the same array until the queue changes. */
  readonly list = (): readonly QueuedCompletion[] => this.items;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Adds the completion; false if the Tenner is already queued. */
  add(item: QueuedCompletion): boolean {
    if (this.items.some((queued) => queued.tennerId === item.tennerId)) return false;
    this.write([...this.items, item]);
    return true;
  }

  /** Removes the entry; false if it was not (or no longer) queued. */
  remove(idempotencyKey: string): boolean {
    const remaining = this.items.filter((item) => item.idempotencyKey !== idempotencyKey);
    if (remaining.length === this.items.length) return false;
    this.write(remaining);
    return true;
  }

  private write(items: readonly QueuedCompletion[]): void {
    this.items = items;
    try {
      if (items.length === 0) this.storage.removeItem(this.key);
      else this.storage.setItem(this.key, JSON.stringify(items));
    } catch {
      // Storage full or blocked: the queue still works for this session.
    }
    this.listeners.forEach((listener) => listener());
  }
}

/** Sends one completion with an explicit completedAt (the API call). */
export type SendCompletion = (item: QueuedCompletion, completedAt: string) => Promise<unknown>;

export interface DroppedCompletion {
  readonly item: QueuedCompletion;
  readonly message: string;
}

export interface SyncReport {
  readonly synced: readonly QueuedCompletion[];
  readonly dropped: readonly DroppedCompletion[];
  /** Entries left for the next attempt (connection or server problem). */
  readonly remaining: number;
}

/** Why the server refused the completion for good; undefined if a later retry may succeed. */
function rejection(error: unknown): string | undefined {
  if (!isApiError(error) || error.isTransient || error.status === 401) return undefined;
  if (error.code === "CONCURRENT_MODIFICATION") return undefined;
  if (error.status === 404 || error.code === "TENNER_INACTIVE")
    return "Die Aufgabe wurde inzwischen gelöscht oder archiviert.";
  if (error.details.some((detail) => detail.field === "completedAt")) {
    return "Die Aufgabe wurde inzwischen schon erledigt.";
  }
  return errorMessage(error);
}

async function sendOnce(send: SendCompletion, item: QueuedCompletion, completedAt: string): Promise<void> {
  try {
    await send(item, completedAt);
  } catch (error) {
    // Someone changed the Tenner at the same moment: one immediate retry against the new version.
    if (isApiError(error) && error.code === "CONCURRENT_MODIFICATION") {
      await send(item, completedAt);
      return;
    }
    throw error;
  }
}

/**
 * Replays the queue in order. Stops at the first error that a later attempt may fix (network, 5xx, 429, 401,
 * repeated concurrent modification) and keeps that entry and the ones after it. Entries the server rejects for good
 * are removed and reported.
 */
export async function syncQueue(
  queue: CompletionQueue,
  send: SendCompletion,
  now: () => number = Date.now,
): Promise<SyncReport> {
  const synced: QueuedCompletion[] = [];
  const dropped: DroppedCompletion[] = [];
  for (const item of queue.list()) {
    const queuedAt = Date.parse(item.completedAt);
    if (!(queuedAt <= now() + MAX_CLOCK_SKEW_MS)) {
      queue.remove(item.idempotencyKey);
      dropped.push({ item, message: "Der Zeitpunkt liegt in der Zukunft. Bitte prüfe die Uhrzeit des Geräts." });
      continue;
    }
    const completedAt = new Date(Math.min(queuedAt, now())).toISOString();
    try {
      await sendOnce(send, item, completedAt);
      queue.remove(item.idempotencyKey);
      synced.push(item);
    } catch (error) {
      const message = rejection(error);
      if (message === undefined) break;
      queue.remove(item.idempotencyKey);
      dropped.push({ item, message });
    }
  }
  return { synced, dropped, remaining: queue.list().length };
}

/**
 * Logout (MOBILE-004): queued completions would be lost, so ask first; when confirmed (or nothing is queued) the
 * queue is deleted from the device. Returns whether the logout may continue.
 */
export function releaseQueueForLogout(
  storage: CacheStorage,
  confirm: (message: string) => boolean,
  key: string = OFFLINE_QUEUE_KEY,
): boolean {
  const count = readQueue(storage, key).length;
  const message =
    count === 1
      ? "1 Offline-Erledigung ist noch nicht übertragen und geht beim Abmelden verloren. Trotzdem abmelden?"
      : `${count} Offline-Erledigungen sind noch nicht übertragen und gehen beim Abmelden verloren. Trotzdem abmelden?`;
  if (count > 0 && !confirm(message)) return false;
  try {
    storage.removeItem(key);
  } catch {
    // Nothing stored.
  }
  return true;
}
