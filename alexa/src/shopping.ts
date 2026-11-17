/**
 * Shopping list by voice (FOOD-026): the same list as the app (FOOD-014), read and changed through the Tenner API.
 * Pure answer builders plus the three API calls; the handlers live in handlers/shopping.ts.
 */

import { matchTenner, type MatchCandidate } from "./matcher.js";
import { joinAlternatives } from "./speech.js";
import type { TennerApi } from "./tennerApi.js";

const LIST_PATH = "/meals/plans/current/shopping-list";
/** Items read out at once; the rest is only counted. */
export const READ_LIMIT = 10;
/** Item names are limited like in the app (FOOD-014). */
export const ITEM_NAME_MAX = 40;

export interface ShoppingItem {
  readonly key: string;
  readonly name: string;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly pantry: boolean;
  readonly checked: boolean;
}

interface ShoppingList {
  readonly items: readonly ShoppingItem[];
}

export const fetchShoppingList = async (api: TennerApi): Promise<readonly ShoppingItem[]> => (await api.request<ShoppingList>("GET", LIST_PATH)).items;

type Operation = { type: "add"; key: string; name: string } | { type: "check"; key: string; checked: boolean };
const changeList = async (api: TennerApi, operations: readonly Operation[]): Promise<void> => {
  await api.request("POST", `${LIST_PATH}/changes`, { operations });
};

/** Key of a spoken item: derived from the Alexa request ID, so Alexa's retries add it only once. */
export function itemKeyOf(requestId: string): string {
  return `manual-alexa-${requestId.replace(/[^A-Za-z0-9]/g, "").slice(-48)}`;
}

/** „milch“ → „Milch“; trimmed to the app's length limit. */
export function itemName(spoken: string): string {
  const trimmed = spoken.trim().replace(/\s+/g, " ").slice(0, ITEM_NAME_MAX).trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export const addItem = (api: TennerApi, requestId: string, name: string): Promise<void> => addItems(api, requestId, [name]);

/** Several items in one change (MAINT-018); keys stay stable for Alexa's retries of the same request. */
export const addItems = (api: TennerApi, requestId: string, names: readonly string[]): Promise<void> =>
  changeList(api, names.map((name, index) => ({ type: "add" as const, key: index === 0 ? itemKeyOf(requestId) : `${itemKeyOf(requestId)}-${index}`, name })));

/** Split the spoken items of one sentence (MAINT-018): one name per slot, a slot value „milch und eier“ splits at „und“ and commas. */
export function spokenNames(values: readonly (string | undefined)[]): string[] {
  const names = values
    .flatMap((value) => (value ?? "").split(/,|\bund\b|\bsowie\b/i))
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(itemName);
  return names.filter((name, index) => names.findIndex((other) => other.toLocaleLowerCase("de") === name.toLocaleLowerCase("de")) === index);
}
export const checkItem = (api: TennerApi, key: string): Promise<void> => changeList(api, [{ type: "check", key, checked: true }]);

/** Open items in the list's order, pantry items included (MAINT-014). */
export const openItems = (items: readonly ShoppingItem[]): ShoppingItem[] => items.filter((item) => !item.checked);

/** „2 mal Hackfleisch“ for counts above one (FOOD-028), else the name. */
export const spokenItem = (item: ShoppingItem): string => (item.quantity !== null && item.quantity > 1 && item.unit === "Stück" ? `${item.quantity} mal ${item.name}` : item.name);

export function readAnswer(items: readonly ShoppingItem[]): string {
  const open = openItems(items);
  if (open.length === 0) return "Die Einkaufsliste ist leer.";
  const shown = open.slice(0, READ_LIMIT).map(spokenItem);
  const rest = open.length - shown.length;
  const head = open.length === 1 ? "Auf der Einkaufsliste steht" : `Auf der Einkaufsliste stehen ${open.length} Sachen`;
  return `${head}: ${joinAlternatives(shown, "und")}.${rest > 0 ? ` Und ${rest} weitere in der App.` : ""}`;
}

/** An open item with the same name (ignoring case and spaces), so an item is not added twice. */
export const sameOpenItem = (items: readonly ShoppingItem[], name: string): ShoppingItem | undefined =>
  items.find((item) => !item.checked && item.name.toLocaleLowerCase("de").replace(/\s+/g, " ") === name.toLocaleLowerCase("de"));

export type ItemMatch = { readonly kind: "clear"; readonly item: ShoppingItem } | { readonly kind: "ambiguous"; readonly options: readonly ShoppingItem[] } | { readonly kind: "none" };

/** Spoken name → open item, with the Tenner matching rules (ALEXA-004): it never guesses between close candidates. */
export function matchItem(spoken: string, items: readonly ShoppingItem[]): ItemMatch {
  const open = items.filter((item) => !item.checked);
  const byKey = new Map(open.map((item) => [item.key, item]));
  const result = matchTenner(spoken, open.map((item) => ({ tennerId: item.key, title: item.name, due: false })));
  const itemOf = (candidate: MatchCandidate): ShoppingItem => byKey.get(candidate.tennerId) as ShoppingItem;
  if (result.kind === "clear") return { kind: "clear", item: itemOf(result.tenner) };
  if (result.kind === "ambiguous") return { kind: "ambiguous", options: result.options.map(itemOf) };
  return { kind: "none" };
}
