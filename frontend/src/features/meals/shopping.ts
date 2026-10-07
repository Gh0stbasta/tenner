/**
 * Shopping list helpers (FOOD-014): the same idempotent changes as the backend (applied at once on the device, also
 * offline), display texts and the share text.
 */

import type { ShoppingItem, ShoppingOperation } from "./api";
import { MEAL_SLOT_LABELS } from "./labels";

export const SHOPPING_SECTION_LABELS: Readonly<Record<ShoppingItem["section"], string>> = {
  GEMUESE_OBST: "Gemüse & Obst",
  BACKWAREN: "Backwaren",
  KUEHLREGAL: "Kühlregal",
  FLEISCH_FISCH: "Fleisch & Fisch",
  TIEFKUEHL: "Tiefkühl",
  TROCKENWAREN: "Trockenwaren",
  GEWUERZE: "Gewürze & Öle",
  SONSTIGES: "Sonstiges",
};

/** Mirror of the backend's applyOperations: unknown keys are ignored, every change can be replayed. */
export function applyShoppingOperations(
  items: readonly ShoppingItem[],
  operations: readonly ShoppingOperation[],
): ShoppingItem[] {
  let result = [...items];
  for (const operation of operations) {
    if (operation.type === "check") {
      result = result.map((item) => (item.key === operation.key ? { ...item, checked: operation.checked } : item));
    } else if (operation.type === "add") {
      if (!result.some((item) => item.key === operation.key)) {
        result.push({
          key: operation.key,
          ingredientId: null,
          name: operation.name,
          quantity: null,
          unit: null,
          section: "SONSTIGES",
          pantry: false,
          checked: false,
          manual: true,
          usedFor: [],
        });
      }
    } else if (operation.type === "remove") {
      result = result.filter((item) => item.key !== operation.key);
    } else {
      const moving = result.find((item) => item.key === operation.key);
      if (!moving || operation.afterKey === operation.key) continue;
      const rest = result.filter((item) => item.key !== operation.key);
      const anchor = operation.afterKey === null ? -1 : rest.findIndex((item) => item.key === operation.afterKey);
      if (operation.afterKey !== null && anchor < 0) continue;
      rest.splice(anchor + 1, 0, moving);
      result = rest;
    }
  }
  return result;
}

/** The list as shown: open items in the own order, pantry items, ticked items at the end. */
export function groupShoppingItems(items: readonly ShoppingItem[]) {
  return {
    open: items.filter((item) => !item.checked && !item.pantry),
    pantry: items.filter((item) => !item.checked && item.pantry),
    done: items.filter((item) => item.checked),
  };
}

/**
 * Drag and drop of open items: the move that puts `activeKey` where `overKey` was (after the open item before it in
 * the new order, or first).
 */
export function moveOperation(
  open: readonly ShoppingItem[],
  activeKey: string,
  overKey: string,
): ShoppingOperation | undefined {
  const from = open.findIndex((item) => item.key === activeKey);
  const to = open.findIndex((item) => item.key === overKey);
  if (from < 0 || to < 0 || from === to) return undefined;
  const reordered = open.filter((item) => item.key !== activeKey);
  reordered.splice(to, 0, open[from] as ShoppingItem);
  const before = reordered[to - 1];
  return { type: "move", key: activeKey, afterKey: before ? before.key : null };
}

const NUMBER = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** „500 g“, „1,5 kg“, „2 Stück“; own items have no quantity. */
export function formatQuantity(item: Pick<ShoppingItem, "quantity" | "unit">): string {
  if (item.quantity === null || item.unit === null) return "";
  if (item.unit === "g" && item.quantity >= 1000) return `${NUMBER.format(item.quantity / 1000)} kg`;
  if (item.unit === "ml" && item.quantity >= 1000) return `${NUMBER.format(item.quantity / 1000)} l`;
  return `${NUMBER.format(item.quantity)} ${item.unit}`;
}

const WEEKDAY = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" });

/** „für Mo Abend, Do Mittag“. */
export function usedForLabel(slotIds: readonly string[]): string {
  const meals = slotIds.map((slotId) => {
    const [date = "", slot = "LUNCH"] = slotId.split("#");
    const weekday = WEEKDAY.format(new Date(`${date}T12:00:00Z`)).replace(".", "");
    return `${weekday} ${MEAL_SLOT_LABELS[slot as keyof typeof MEAL_SLOT_LABELS]}`;
  });
  return meals.length > 0 ? `für ${meals.join(", ")}` : "";
}

const itemLine = (item: ShoppingItem) => `- ${[formatQuantity(item), item.name].filter(Boolean).join(" ")}`;

/** Text for „Teilen“: open items in the own order, then the pantry items to check. */
export function shareText(title: string, items: readonly ShoppingItem[]): string {
  const { open, pantry } = groupShoppingItems(items);
  return [
    title,
    "",
    ...open.map(itemLine),
    ...(pantry.length > 0 ? ["", "Vorrat prüfen:", ...pantry.map(itemLine)] : []),
  ].join("\n");
}
