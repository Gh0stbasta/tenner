/** FOOD-026: shopping list by voice — add, read, tick off; same list as the app. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { itemKeyOf, itemName, matchItem, readAnswer, spokenItem, type ShoppingItem } from "../src/shopping.js";
import { createSkill } from "../src/skill.js";
import { SKILL_ID, intentRequest } from "./envelopes.js";
import { API_BASE, fakeApi, type FakeRoute } from "./fakeApi.js";
import { ssml } from "./ssml.js";

const item = (key: string, name: string, extra: Partial<ShoppingItem> = {}): ShoppingItem => ({ key, name, quantity: 1, unit: "Stück", pantry: false, checked: false, ...extra });
const ITEMS = [
  item("pasta", "Nudeln", { quantity: 2 }),
  item("milk", "Milch"),
  item("manual-1", "Klopapier", { quantity: null, unit: null }),
  item("salt", "Salz", { pantry: true }),
  item("eggs", "Eier", { checked: true }),
];
const LIST = "GET /meals/plans/current/shopping-list";
const CHANGES = "POST /meals/plans/current/shopping-list/changes";

function setup(routes: Record<string, FakeRoute> = {}) {
  const changes: unknown[] = [];
  const api = fakeApi({
    [LIST]: { data: { items: ITEMS } },
    [CHANGES]: (body) => {
      changes.push(body);
      return { data: { items: ITEMS } };
    },
    ...routes,
  });
  return { skill: createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch), changes };
}

afterEach(() => vi.restoreAllMocks());

describe("shopping helpers", () => {
  it("reads open items in order with counts, leaving out pantry and ticked items", () => {
    expect(readAnswer(ITEMS)).toBe("Auf der Einkaufsliste stehen 3 Sachen: 2 mal Nudeln, Milch und Klopapier.");
    expect(readAnswer([item("milk", "Milch")])).toBe("Auf der Einkaufsliste steht: Milch.");
    expect(readAnswer([])).toBe("Die Einkaufsliste ist leer.");
    const many = Array.from({ length: 12 }, (_, index) => item(`i${index}`, `Ding ${index}`));
    expect(readAnswer(many)).toMatch(/Ding 9\. Und 2 weitere in der App\.$/);
    expect(spokenItem(item("x", "Eier", { quantity: 6 }))).toBe("6 mal Eier");
  });

  it("derives a stable, valid key from the request and tidies the name", () => {
    expect(itemKeyOf("amzn1.echo-api.request.0000-1111")).toBe("manual-alexa-amzn1echoapirequest00001111");
    expect(itemKeyOf("amzn1.echo-api.request.0000-1111")).toMatch(/^manual-[A-Za-z0-9-]{1,64}$/);
    expect(itemName("  frische   milch ")).toBe("Frische milch");
    expect(itemName("x".repeat(60))).toHaveLength(40);
  });

  it("matches spoken names like Tenner titles and never guesses", () => {
    expect(matchItem("milch", ITEMS)).toMatchObject({ kind: "clear", item: { key: "milk" } });
    expect(matchItem("eier", ITEMS)).toEqual({ kind: "none" });
    expect(matchItem("banane", ITEMS)).toEqual({ kind: "none" });
    expect(matchItem("milch", [item("a", "Milch"), item("b", "Hafermilch")])).toMatchObject({ kind: "clear", item: { key: "a" } });
    expect(matchItem("milch", [item("a", "Milch fettarm"), item("b", "Milch vollfett")])).toMatchObject({ kind: "ambiguous", options: [{ key: "a" }, { key: "b" }] });
  });
});

describe("AddShoppingItemIntent", () => {
  it("adds the spoken item to the household's list", async () => {
    const { skill, changes } = setup();
    const response = await skill.invoke(intentRequest("AddShoppingItemIntent", { item: { value: "spülmittel" } }));
    expect(ssml(response)).toBe("<speak>Okay, Spülmittel steht auf der Einkaufsliste.</speak>");
    expect(changes).toEqual([{ operations: [{ type: "add", key: expect.stringMatching(/^manual-alexa-/), name: "Spülmittel" }] }]);
  });

  it("does not add an item twice", async () => {
    const { skill, changes } = setup();
    const response = await skill.invoke(intentRequest("AddShoppingItemIntent", { item: { value: "milch" } }));
    expect(ssml(response)).toBe("<speak>Milch steht schon auf der Einkaufsliste.</speak>");
    expect(changes).toEqual([]);
  });

  it("explains a missing list and a missing item", async () => {
    const noPlan = setup({ [LIST]: { status: 404, error: { code: "NOT_FOUND" } } });
    expect(ssml(await noPlan.skill.invoke(intentRequest("AddShoppingItemIntent", { item: { value: "milch" } })))).toContain("noch keine Einkaufsliste");
    const { skill } = setup();
    expect(ssml(await skill.invoke(intentRequest("AddShoppingItemIntent")))).toContain("Setz Milch auf die Einkaufsliste");
  });
});

describe("ReadShoppingListIntent", () => {
  it("reads the open items", async () => {
    const { skill } = setup();
    expect(ssml(await skill.invoke(intentRequest("ReadShoppingListIntent")))).toBe("<speak>Auf der Einkaufsliste stehen 3 Sachen: 2 mal Nudeln, Milch und Klopapier.</speak>");
  });
});

describe("ShoppingItemBoughtIntent", () => {
  it("ticks off the matching item", async () => {
    const { skill, changes } = setup();
    const response = await skill.invoke(intentRequest("ShoppingItemBoughtIntent", { item: { value: "nudeln" } }));
    expect(ssml(response)).toBe("<speak>Okay, Nudeln ist abgehakt.</speak>");
    expect(changes).toEqual([{ operations: [{ type: "check", key: "pasta", checked: true }] }]);
  });

  it("asks back on unknown or ambiguous names without changing the list", async () => {
    const { skill, changes } = setup({ [LIST]: { data: { items: [item("a", "Milch fettarm"), item("b", "Milch vollfett"), item("c", "Brot")] } } });
    expect(ssml(await skill.invoke(intentRequest("ShoppingItemBoughtIntent", { item: { value: "bananen" } })))).toBe("<speak>Bananen steht nicht auf der Einkaufsliste.</speak>");
    const ambiguous = ssml(await skill.invoke(intentRequest("ShoppingItemBoughtIntent", { item: { value: "milch" } })));
    expect(ambiguous).toBe("<speak>Meinst du Milch fettarm oder Milch vollfett? Sag zum Beispiel: Ich habe Milch fettarm gekauft.</speak>");
    expect(changes).toEqual([]);
  });
});
