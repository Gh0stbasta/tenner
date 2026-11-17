/** MAINT-023: „Übersicht“ opens the Tafel in the Echo Show's browser. */

import { describe, expect, it } from "vitest";
import { overviewDocument, OVERVIEW_SPEECH } from "../src/handlers/overview.js";
import { createSkill } from "../src/skill.js";
import { SKILL_ID, intentRequest } from "./envelopes.js";
import { API_BASE, fakeApi } from "./fakeApi.js";
import { ssml } from "./ssml.js";

const WEB = "https://d111111abcdef8.cloudfront.net";
const skill = (webAppUrl?: string) => createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200, ...(webAppUrl === undefined ? {} : { webAppUrl }) }, fakeApi().fetch);
const SCREEN = { supportedInterfaces: { "Alexa.Presentation.APL": { runtime: { maxVersion: "2023.2" } } } };

describe("OverviewIntent (MAINT-023)", () => {
  it("opens /tafel with OpenURL on a screen device and shows the address when the device refuses", async () => {
    const response = await skill(WEB).invoke(intentRequest("OverviewIntent", {}, SCREEN));
    expect(ssml(response)).toBe(`<speak>${OVERVIEW_SPEECH.opening}</speak>`);
    expect(response.response.shouldEndSession).toBe(true);
    const [directive] = response.response.directives ?? [];
    expect(directive).toMatchObject({ type: "Alexa.Presentation.APL.RenderDocument", token: "overview" });
    const document = (directive as unknown as { document: { onMount: { type: string; source: string; onFail: { value: string }[] }[] } }).document;
    expect(document.onMount[0]).toMatchObject({ type: "OpenURL", source: `${WEB}/tafel` });
    expect(document.onMount[0]?.onFail[0]?.value).toBe(`Öffne den Browser und geh auf ${WEB}/tafel`);
    expect(JSON.stringify(overviewDocument("https://x.test/tafel"))).not.toContain("Authorization");
  });

  it("sends a card on devices without a screen", async () => {
    const response = await skill(WEB).invoke(intentRequest("OverviewIntent"));
    expect(ssml(response)).toBe(`<speak>${OVERVIEW_SPEECH.noScreen}</speak>`);
    expect(response.response.directives ?? []).toEqual([]);
    expect(response.response.card).toMatchObject({ type: "Simple", content: `Öffne den Browser und geh auf ${WEB}/tafel` });
  });

  it("says when the web app URL is not configured", async () => {
    const response = await skill("").invoke(intentRequest("OverviewIntent", {}, SCREEN));
    expect(ssml(response)).toBe(`<speak>${OVERVIEW_SPEECH.notConfigured}</speak>`);
    expect(response.response.directives ?? []).toEqual([]);
  });
});
