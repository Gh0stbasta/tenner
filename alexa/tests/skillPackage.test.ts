import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown => JSON.parse(readFileSync(new URL(`../skill-package/${path}`, import.meta.url), "utf8"));

interface LanguageModel {
  invocationName: string;
  intents: { name: string; samples: string[]; slots?: { name: string; type: string }[] }[];
  types: { name: string; values: { name: { value: string } }[] }[];
}

describe("skill package", () => {
  const model = (readJson("interactionModels/custom/de-DE.json") as { interactionModel: { languageModel: LanguageModel } })
    .interactionModel.languageModel;

  it("uses the invocation name mary poppins (ALEXA-010, REC-002, MAINT-017)", () => {
    expect(model.invocationName).toBe("mary poppins");
  });

  it("declares the required built-in intents", () => {
    const names = model.intents.map((intent) => intent.name);
    expect(names).toEqual(
      expect.arrayContaining(["AMAZON.HelpIntent", "AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.FallbackIntent", "AMAZON.NavigateHomeIntent"]),
    );
  });

  it("has unique intent names and lowercase samples without duplicates", () => {
    const names = model.intents.map((intent) => intent.name);
    expect(new Set(names).size).toBe(names.length);
    const samples = model.intents.flatMap((intent) => intent.samples);
    expect(new Set(samples).size).toBe(samples.length);
    for (const sample of samples) {
      expect(sample).toBe(sample.toLowerCase());
    }
  });

  it("takes the item alone and up to five items for the shopping list (MAINT-018)", () => {
    const add = model.intents.find((intent) => intent.name === "AddShoppingItemIntent");
    expect(add?.samples).toEqual(expect.arrayContaining(["{item1}", "{item1} {item2} {item3} {item4} und {item5}", "wir brauchen {item1} und {item2}"]));
    // A sample with the free-text slot must not contain any other slot (Alexa model rule for AMAZON.SearchQuery).
    for (const sample of add?.samples ?? []) {
      if (sample.includes("{item}")) expect(sample.match(/\{/g)).toHaveLength(1);
    }
    const products = model.types.find((type) => type.name === "ShoppingProduct")?.values.map((value) => value.name.value) ?? [];
    expect(products).toEqual(expect.arrayContaining(["milch", "eier", "klopapier"]));
    expect(new Set(products).size).toBe(products.length);
    expect(model.intents.map((intent) => intent.name)).toEqual(expect.arrayContaining(["ShoppingModeIntent", "ShoppingDoneIntent"]));
  });

  it("targets de-DE and gets the Lambda ARN at deploy time", () => {
    const manifest = readJson("skill.json") as {
      manifest: { publishingInformation: { locales: Record<string, unknown> }; apis: { custom: { endpoint: { uri: string } } } };
    };
    expect(Object.keys(manifest.manifest.publishingInformation.locales)).toEqual(["de-DE"]);
    expect(manifest.manifest.apis.custom.endpoint.uri).toBe("${SKILL_LAMBDA_ARN}");
  });

  it("requests the notifications permission when it publishes events (HOTFIX-004)", () => {
    const manifest = readJson("skill.json") as {
      manifest: { permissions: { name: string }[]; events?: { publications?: unknown[] } };
    };
    const permissions = manifest.manifest.permissions.map((permission) => permission.name);
    expect(manifest.manifest.events?.publications?.length).toBeGreaterThan(0);
    expect(permissions).toContain("alexa::devices:all:notifications:write");
  });
});

describe("utterance conflicts (ALEXA-009)", () => {
  const model = (readJson("interactionModels/custom/de-DE.json") as { interactionModel: { languageModel: LanguageModel } }).interactionModel.languageModel;

  it("has no sample that two intents share once slots are normalized (except the deliberate slot-only answers)", () => {
    const owners = new Map<string, Set<string>>();
    for (const intent of model.intents) {
      for (const sample of intent.samples) {
        const normalized = sample.replace(/\{[^}]+\}/g, "{}");
        owners.set(normalized, (owners.get(normalized) ?? new Set()).add(intent.name));
      }
    }
    const conflicts = [...owners].filter(([sample, intents]) => intents.size > 1 && sample !== "{}");
    expect(conflicts).toEqual([]);
    // Slot-only answers: SpeakerIntent ({member}) and CompleteIntent ({tenner}); both handlers accept either (ALEXA-004).
    // AddShoppingItemIntent ({item1}, MAINT-018): the slot values decide; in the shopping mode the others count as items.
    expect([...(owners.get("{}") ?? [])].sort()).toEqual(["AddShoppingItemIntent", "CompleteIntent", "SpeakerIntent"]);
  });

  it("declares every slot type it uses", () => {
    const declared = new Set((model as unknown as { types: { name: string }[] }).types.map((type) => type.name));
    const used = model.intents.flatMap((intent) => ((intent as unknown as { slots?: { type: string }[] }).slots ?? []).map((slot) => slot.type)).filter((type) => !type.startsWith("AMAZON."));
    for (const type of used) expect(declared.has(type)).toBe(true);
  });
});
