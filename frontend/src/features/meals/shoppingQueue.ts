/**
 * Offline changes of the shopping list (FOOD-014, pattern of MOBILE-004): every tick, own item or move is stored on
 * the device first and sent when there is a connection. The changes are idempotent, so sending one twice does no
 * harm; the page shows the server list with the queued changes applied.
 */

import type { CacheStorage } from "../offline/persistence";
import type { ShoppingOperation } from "./api";

export const SHOPPING_QUEUE_KEY = "tenner.shoppingQueue";

export interface QueuedShoppingChange {
  /** Week start of the list (a week reference would change at midnight on the last day). */
  readonly weekStart: string;
  readonly operation: ShoppingOperation;
}

function readQueue(storage: CacheStorage, key: string): readonly QueuedShoppingChange[] {
  try {
    const stored = storage.getItem(key);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? (parsed as QueuedShoppingChange[]) : [];
  } catch {
    return [];
  }
}

/** Queue in Web Storage with change notifications (for useSyncExternalStore). */
export class ShoppingQueue {
  private items: readonly QueuedShoppingChange[];
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storage: CacheStorage,
    private readonly key: string = SHOPPING_QUEUE_KEY,
  ) {
    this.items = readQueue(storage, key);
  }

  /** Current entries, oldest first; the same array until the queue changes. */
  readonly list = (): readonly QueuedShoppingChange[] => this.items;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  add(changes: readonly QueuedShoppingChange[]): void {
    this.write([...this.items, ...changes]);
  }

  /** Removes exactly these entries (sent or rejected); entries added meanwhile stay. */
  remove(changes: readonly QueuedShoppingChange[]): void {
    const sent = new Set(changes);
    this.write(this.items.filter((item) => !sent.has(item)));
  }

  private write(items: readonly QueuedShoppingChange[]): void {
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

/** Logout: unsent shopping list changes are not worth a question; they are dropped with the other data. */
export function clearShoppingQueue(storage: CacheStorage, key: string = SHOPPING_QUEUE_KEY): void {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}

/** Sends the queued changes of one list. */
export type SendShoppingChanges = (weekStart: string, operations: readonly ShoppingOperation[]) => Promise<unknown>;

/**
 * Sends the queue list by list. Returns false when a later attempt may succeed (network, 5xx, 429, 401) and keeps
 * those entries; changes the server rejects for good are dropped and reported through `onRejected`.
 */
export async function flushShoppingQueue(
  queue: ShoppingQueue,
  send: SendShoppingChanges,
  onSent: (weekStart: string, result: unknown) => void,
  onRejected: (error: unknown) => void,
  isRetryable: (error: unknown) => boolean,
): Promise<boolean> {
  for (;;) {
    const [first] = queue.list();
    if (!first) return true;
    const batch = queue.list().filter((item) => item.weekStart === first.weekStart);
    try {
      const result = await send(
        first.weekStart,
        batch.map((item) => item.operation),
      );
      queue.remove(batch);
      onSent(first.weekStart, result);
    } catch (error) {
      if (isRetryable(error)) return false;
      queue.remove(batch);
      onRejected(error);
    }
  }
}
