import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import {
  CompletionQueue,
  MAX_CLOCK_SKEW_MS,
  OFFLINE_QUEUE_KEY,
  releaseQueueForLogout,
  syncQueue,
  type QueuedCompletion,
} from "./completionQueue";
import type { CacheStorage } from "./persistence";

function memoryStorage(): CacheStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const NOW = Date.parse("2026-10-06T12:00:00Z");

function item(n: number, completedAt = "2026-10-06T11:00:00.000Z"): QueuedCompletion {
  return { tennerId: `t-${n}`, title: `Aufgaben ${n}`, completedBy: "STEFAN", completedAt, idempotencyKey: `k-${n}` };
}

function queueWith(...items: QueuedCompletion[]) {
  const queue = new CompletionQueue(memoryStorage());
  items.forEach((entry) => queue.add(entry));
  return queue;
}

const conflict = () => new ApiError(409, "CONCURRENT_MODIFICATION", "conflict");

describe("CompletionQueue (MOBILE-004)", () => {
  it("stores entries in order, survives a restart and ignores a second entry for the same Tenner", () => {
    const storage = memoryStorage();
    const queue = new CompletionQueue(storage);
    const listener = vi.fn();
    queue.subscribe(listener);
    expect(queue.add(item(1))).toBe(true);
    expect(queue.add(item(2))).toBe(true);
    expect(queue.add({ ...item(1), idempotencyKey: "other" })).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(new CompletionQueue(storage).list().map((entry) => entry.tennerId)).toEqual(["t-1", "t-2"]);
    expect(queue.remove("k-1")).toBe(true);
    expect(queue.remove("k-1")).toBe(false);
    queue.remove("k-2");
    expect(storage.data.has(OFFLINE_QUEUE_KEY)).toBe(false);
  });

  it("starts empty on corrupt or blocked storage and keeps working in memory", () => {
    const corrupt = memoryStorage();
    corrupt.setItem(OFFLINE_QUEUE_KEY, "{oops");
    expect(new CompletionQueue(corrupt).list()).toEqual([]);
    corrupt.setItem(OFFLINE_QUEUE_KEY, '{"not":"a list"}');
    expect(new CompletionQueue(corrupt).list()).toEqual([]);
    const blocked: CacheStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    };
    const queue = new CompletionQueue(blocked);
    expect(queue.add(item(1))).toBe(true);
    expect(queue.list()).toHaveLength(1);
  });
});

describe("syncQueue (MOBILE-004)", () => {
  it("replays in order with the queued time and Idempotency-Key", async () => {
    const queue = queueWith(item(1), item(2));
    const send = vi.fn(async () => undefined);
    const report = await syncQueue(queue, send, () => NOW);
    expect(send.mock.calls).toEqual([
      [item(1), "2026-10-06T11:00:00.000Z"],
      [item(2), "2026-10-06T11:00:00.000Z"],
    ]);
    expect(report).toEqual({ synced: [item(1), item(2)], dropped: [], remaining: 0 });
  });

  it("stops at a connection or server problem and keeps the rest", async () => {
    for (const error of [
      new ApiError(0, "NETWORK_ERROR", "offline"),
      new ApiError(503, "X", "down"),
      new ApiError(401, "UNAUTHORIZED", "x"),
      new Error("unknown"),
    ]) {
      const queue = queueWith(item(1), item(2), item(3));
      const send = vi.fn(async (entry: QueuedCompletion) => {
        if (entry.tennerId === "t-2") throw error;
      });
      const report = await syncQueue(queue, send, () => NOW);
      expect(report.synced).toEqual([item(1)]);
      expect(report.remaining).toBe(2);
      expect(send).toHaveBeenCalledTimes(2);
    }
  });

  it("retries a concurrent modification once, and keeps the entry if it happens again", async () => {
    const once = queueWith(item(1));
    const sendOnce = vi.fn().mockRejectedValueOnce(conflict()).mockResolvedValueOnce(undefined);
    expect((await syncQueue(once, sendOnce, () => NOW)).synced).toEqual([item(1)]);
    expect(sendOnce).toHaveBeenCalledTimes(2);

    const twice = queueWith(item(1));
    const sendTwice = vi.fn().mockRejectedValue(conflict());
    expect(await syncQueue(twice, sendTwice, () => NOW)).toEqual({ synced: [], dropped: [], remaining: 1 });
  });

  it("drops entries the server refuses for good, with a reason", async () => {
    const errors = [
      new ApiError(404, "NOT_FOUND", "gone"),
      new ApiError(409, "TENNER_INACTIVE", "archived"),
      new ApiError(400, "VALIDATION_ERROR", "invalid", [
        { field: "completedAt", message: "Must not be earlier than the last completion." },
      ]),
      new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "reused"),
    ];
    const queue = queueWith(item(1), item(2), item(3), item(4), item(5));
    const send = vi.fn(async (entry: QueuedCompletion) => {
      const error = errors[Number(entry.tennerId.slice(2)) - 1];
      if (error) throw error;
    });
    const report = await syncQueue(queue, send, () => NOW);
    expect(report.synced).toEqual([item(5)]);
    expect(report.remaining).toBe(0);
    expect(report.dropped.map((entry) => entry.message)).toEqual([
      "Die Aufgabe wurde inzwischen gelöscht oder archiviert.",
      "Die Aufgabe wurde inzwischen gelöscht oder archiviert.",
      "Die Aufgabe wurde inzwischen schon erledigt.",
      "Diese Aktion wurde bereits mit anderen Daten ausgeführt. Bitte lade neu.",
    ]);
  });

  it("clamps a small clock skew to now and rejects a time far in the future", async () => {
    const soon = new Date(NOW + MAX_CLOCK_SKEW_MS - 1000).toISOString();
    const far = new Date(NOW + MAX_CLOCK_SKEW_MS + 1000).toISOString();
    const queue = queueWith(item(1, soon), item(2, far));
    const send = vi.fn(async () => undefined);
    const report = await syncQueue(queue, send, () => NOW);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(item(1, soon), new Date(NOW).toISOString());
    expect(report.dropped).toEqual([
      { item: item(2, far), message: "Der Zeitpunkt liegt in der Zukunft. Bitte prüfe die Uhrzeit des Geräts." },
    ]);
  });
});

describe("releaseQueueForLogout (MOBILE-004)", () => {
  it("asks before discarding queued completions and deletes the queue only when confirmed", () => {
    const storage = memoryStorage();
    new CompletionQueue(storage).add(item(1));
    const decline = vi.fn(() => false);
    expect(releaseQueueForLogout(storage, decline)).toBe(false);
    expect(decline).toHaveBeenCalledWith(
      "1 Offline-Erledigung ist noch nicht übertragen und geht beim Abmelden verloren. Trotzdem abmelden?",
    );
    expect(storage.data.has(OFFLINE_QUEUE_KEY)).toBe(true);
    new CompletionQueue(storage).add(item(2));
    const accept = vi.fn<(message: string) => boolean>(() => true);
    expect(releaseQueueForLogout(storage, accept)).toBe(true);
    expect(accept.mock.calls[0]?.[0]).toMatch(/^2 Offline-Erledigungen sind/);
    expect(storage.data.has(OFFLINE_QUEUE_KEY)).toBe(false);
  });

  it("logs out without asking when nothing is queued", () => {
    const confirm = vi.fn(() => false);
    expect(releaseQueueForLogout(memoryStorage(), confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    const blocked: CacheStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(releaseQueueForLogout(blocked, confirm)).toBe(true);
  });
});
