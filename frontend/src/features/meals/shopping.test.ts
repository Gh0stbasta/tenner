import { describe, expect, it } from "vitest";
import type { ShoppingItem, ShoppingOperation } from "./api";
import {
  applyShoppingOperations,
  formatQuantity,
  groupShoppingItems,
  moveOperation,
  shareText,
  usedForLabel,
} from "./shopping";
import { SHOPPING_QUEUE_KEY, ShoppingQueue, clearShoppingQueue, flushShoppingQueue } from "./shoppingQueue";

const item = (key: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  key,
  ingredientId: key,
  name: key,
  quantity: 1,
  unit: "Stück",
  section: "TROCKENWAREN",
  pantry: false,
  checked: false,
  manual: false,
  usedFor: [],
  ...overrides,
});

describe("shopping list helpers (FOOD-014)", () => {
  it("applies the same idempotent changes as the backend", () => {
    const items = [item("a"), item("b"), item("c")];
    const operations = [
      { type: "check", key: "a", checked: true },
      { type: "add", key: "manual-1", name: "Klopapier" },
      { type: "add", key: "manual-1", name: "Klopapier" },
      { type: "move", key: "c", afterKey: null },
      { type: "move", key: "b", afterKey: "unknown" },
      { type: "remove", key: "gone" },
    ] as const;
    const result = applyShoppingOperations(items, operations);
    expect(result.map((entry) => entry.key)).toEqual(["c", "a", "b", "manual-1"]);
    expect(applyShoppingOperations(result, operations)).toEqual(result);
    expect(applyShoppingOperations(result, [{ type: "remove", key: "manual-1" }])).toHaveLength(3);
  });

  it("groups open, pantry and ticked items", () => {
    const groups = groupShoppingItems([item("a", { checked: true }), item("salt", { pantry: true }), item("b")]);
    expect(groups.open.map((entry) => entry.key)).toEqual(["b"]);
    expect(groups.pantry.map((entry) => entry.key)).toEqual(["salt"]);
    expect(groups.done.map((entry) => entry.key)).toEqual(["a"]);
  });

  it("turns a drag and drop into a move after the item before the new position", () => {
    const open = [item("a"), item("b"), item("c")];
    expect(moveOperation(open, "c", "a")).toEqual({ type: "move", key: "c", afterKey: null });
    expect(moveOperation(open, "a", "c")).toEqual({ type: "move", key: "a", afterKey: "c" });
    expect(moveOperation(open, "a", "b")).toEqual({ type: "move", key: "a", afterKey: "b" });
    expect(moveOperation(open, "c", "b")).toEqual({ type: "move", key: "c", afterKey: "a" });
    expect(moveOperation(open, "a", "a")).toBeUndefined();
    expect(moveOperation(open, "x", "a")).toBeUndefined();
    const moved = applyShoppingOperations(open, [moveOperation(open, "c", "b") as ShoppingOperation]);
    expect(moved.map((entry) => entry.key)).toEqual(["a", "c", "b"]);
  });

  it("formats quantities, meals and the share text", () => {
    // FOOD-028: counts only; grams from an old cached list are not shown.
    expect(formatQuantity(item("a", { quantity: 2, unit: "Stück" }))).toBe("2×");
    expect(formatQuantity(item("a", { quantity: 1500, unit: "g" }))).toBe("");
    expect(formatQuantity(item("a", { quantity: null, unit: null }))).toBe("");
    expect(usedForLabel(["2026-10-12#DINNER", "2026-10-15#LUNCH"])).toBe("für Mo Abend, Do Mittag");
    expect(usedForLabel([])).toBe("");
    expect(
      shareText("Einkaufsliste", [
        item("pasta", { name: "Nudeln", quantity: 2 }),
        item("m", { name: "Klopapier", quantity: null, unit: null, manual: true }),
        item("x", { name: "Erledigt", checked: true }),
        item("salt", { name: "Salz", pantry: true }),
      ]),
    ).toBe("Einkaufsliste\n\n- 2× Nudeln\n- Klopapier\n\nVorrat prüfen:\n- 1× Salz");
  });
});

describe("shopping queue (FOOD-014)", () => {
  const change = (key: string, weekStart = "2026-10-12") => ({
    weekStart,
    operation: { type: "check" as const, key, checked: true },
  });

  it("keeps changes in storage and sends them per list", async () => {
    const queue = new ShoppingQueue(localStorage);
    queue.add([change("a"), change("b", "2026-10-19"), change("c")]);
    expect(new ShoppingQueue(localStorage).list()).toHaveLength(3);
    const sent: [string, number][] = [];
    const done = await flushShoppingQueue(
      queue,
      async (weekStart, operations) => sent.push([weekStart, operations.length]),
      () => undefined,
      () => undefined,
      () => true,
    );
    expect(done).toBe(true);
    expect(sent).toEqual([
      ["2026-10-12", 2],
      ["2026-10-19", 1],
    ]);
    expect(localStorage.getItem(SHOPPING_QUEUE_KEY)).toBeNull();
  });

  it("keeps changes for a later attempt and drops rejected ones", async () => {
    const queue = new ShoppingQueue(localStorage);
    queue.add([change("a")]);
    const rejected: unknown[] = [];
    expect(
      await flushShoppingQueue(
        queue,
        async () => Promise.reject(new Error("offline")),
        () => undefined,
        (error) => rejected.push(error),
        () => true,
      ),
    ).toBe(false);
    expect(queue.list()).toHaveLength(1);
    expect(
      await flushShoppingQueue(
        queue,
        async () => Promise.reject(new Error("bad")),
        () => undefined,
        (error) => rejected.push(error),
        () => false,
      ),
    ).toBe(true);
    expect(queue.list()).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    queue.add([change("b")]);
    clearShoppingQueue(localStorage);
    expect(localStorage.getItem(SHOPPING_QUEUE_KEY)).toBeNull();
  });
});
