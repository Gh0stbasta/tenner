import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown => JSON.parse(readFileSync(new URL(`../skill-package/${path}`, import.meta.url), "utf8"));

interface LanguageModel {
  invocationName: string;
  intents: { name: string; samples: string[] }[];
}

describe("skill package", () => {
  const model = (readJson("interactionModels/custom/de-DE.json") as { interactionModel: { languageModel: LanguageModel } })
    .interactionModel.languageModel;

  it("uses the invocation name tenner", () => {
    expect(model.invocationName).toBe("tenner");
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

  it("targets de-DE and gets the Lambda ARN at deploy time", () => {
    const manifest = readJson("skill.json") as {
      manifest: { publishingInformation: { locales: Record<string, unknown> }; apis: { custom: { endpoint: { uri: string } } } };
    };
    expect(Object.keys(manifest.manifest.publishingInformation.locales)).toEqual(["de-DE"]);
    expect(manifest.manifest.apis.custom.endpoint.uri).toBe("${SKILL_LAMBDA_ARN}");
  });
});
