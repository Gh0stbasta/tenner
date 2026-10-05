/** ALEXA-002: account linking, API errors and speaker mapping. */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SkillConfig } from "../src/config.js";
import { createSkill } from "../src/skill.js";
import { SPEECH } from "../src/speech.js";
import { ACCOUNT_TOKEN, PERSON_ID, PERSON_TOKEN, SKILL_ID, intentRequest, launchRequest } from "./envelopes.js";
import { API_BASE, CONTEXT, fakeApi, type FakeRoute } from "./fakeApi.js";
import { ssml } from "./ssml.js";

const config = (overrides: Partial<SkillConfig> = {}): SkillConfig => ({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200, ...overrides });

function setup(routes: Record<string, FakeRoute> = {}, overrides: Partial<SkillConfig> = {}) {
  const api = fakeApi(routes);
  return { skill: createSkill(config(overrides), api.fetch), api };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const quiet = () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
};

describe("account linking", () => {
  it("asks to link and sends a LinkAccount card without a token (Missing Token → Link Account Prompt)", async () => {
    quiet();
    const { skill, api } = setup();
    const response = await skill.invoke(launchRequest({ accessToken: null }));
    expect(ssml(response)).toBe(`<speak>${SPEECH.linkAccount}</speak>`);
    expect(response.response.card).toEqual({ type: "LinkAccount" });
    expect(response.response.shouldEndSession).toBe(true);
    expect(api.calls).toHaveLength(0);
  });

  it("calls the API with the account token and the request ID as correlation ID", async () => {
    const { skill, api } = setup();
    await skill.invoke(launchRequest());
    const [url, init] = api.calls[0] ?? [];
    expect(url).toBe(`${API_BASE}/household/alexa`);
    expect(init?.headers).toMatchObject({ authorization: `Bearer ${ACCOUNT_TOKEN}`, "x-correlation-id": "amzn1.echo-api.request.test" });
  });

  it("prefers the recognized person's own token (Person Token Preferred Over Account Token)", async () => {
    const { skill, api } = setup({ "GET /household/alexa": { data: { ...CONTEXT, account: { userId: "JULIA" } } } });
    const response = await skill.invoke(launchRequest({ person: { personId: PERSON_ID, accessToken: PERSON_TOKEN } }));
    expect(api.calls[0]?.[1].headers).toMatchObject({ authorization: `Bearer ${PERSON_TOKEN}` });
    expect(ssml(response)).toBe(`<speak>${SPEECH.welcomeMember("Julia")}</speak>`);
  });

  it("asks to relink on 401 (401 → Relink Prompt)", async () => {
    quiet();
    const { skill } = setup({ "GET /household/alexa": { status: 401, error: { code: "UNAUTHORIZED" } } });
    const response = await skill.invoke(launchRequest());
    expect(ssml(response)).toBe(`<speak>${SPEECH.relink}</speak>`);
    expect(response.response.card).toEqual({ type: "LinkAccount" });
  });

  it("explains a 403 (account without household)", async () => {
    quiet();
    const { skill } = setup({ "GET /household/alexa": { status: 403, error: { code: "FORBIDDEN" } } });
    expect(ssml(await skill.invoke(launchRequest()))).toBe(`<speak>${SPEECH.notInHousehold}</speak>`);
  });

  it.each([
    ["5xx", { status: 503, error: { code: "SERVICE_UNAVAILABLE" } }],
    ["network error", "network-error"],
    ["invalid body", { status: 200 }],
  ] as const)("answers %s with a friendly retry message", async (_name, route) => {
    const error = quiet();
    const { skill } = setup({ "GET /household/alexa": route as FakeRoute });
    const response = await skill.invoke(launchRequest());
    expect(ssml(response)).toBe(`<speak>${SPEECH.unavailable}</speak>`);
    expect(JSON.stringify(error.mock.calls)).not.toContain(ACCOUNT_TOKEN);
  });

  it("answers within the timeout when the API hangs (API Timeout → Friendly Message Within 7 s)", async () => {
    quiet();
    const { skill } = setup({ "GET /household/alexa": "never" }, { apiTimeoutMs: 50 });
    const started = performance.now();
    const response = await skill.invoke(launchRequest());
    expect(ssml(response)).toBe(`<speak>${SPEECH.unavailable}</speak>`);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("treats a missing API base URL as unavailable", async () => {
    quiet();
    const { skill, api } = setup({}, { tennerApiBaseUrl: "" });
    expect(ssml(await skill.invoke(launchRequest()))).toBe(`<speak>${SPEECH.unavailable}</speak>`);
    expect(api.calls).toHaveLength(0);
  });
});

describe("speakers", () => {
  it("teaches Alexa the member names on launch", async () => {
    const { skill } = setup();
    const response = await skill.invoke(launchRequest());
    expect(response.response.directives).toEqual([
      {
        type: "Dialog.UpdateDynamicEntities",
        updateBehavior: "REPLACE",
        types: [
          {
            name: "TennerMember",
            values: [
              { id: "STEFAN", name: { value: "Stefan", synonyms: [] } },
              { id: "JULIA", name: { value: "Julia", synonyms: [] } },
            ],
          },
        ],
      },
    ]);
  });

  it("greets a mapped speaker by name (Speaker Mapping Use)", async () => {
    const { skill } = setup({ "GET /household/alexa": { data: { ...CONTEXT, speakers: [{ personId: PERSON_ID, userId: "JULIA" }] } } });
    const response = await skill.invoke(launchRequest({ person: { personId: PERSON_ID } }));
    expect(ssml(response)).toBe(`<speak>${SPEECH.welcomeMember("Julia")}</speak>`);
  });

  it("asks an unmapped voice once who is speaking and stores the answer (Speaker Mapping Create)", async () => {
    const linked = vi.fn((body: unknown) => ({ data: { ...CONTEXT, speakers: [{ personId: PERSON_ID, userId: (body as { userId: string }).userId }] } }));
    const { skill, api } = setup({ [`PUT /household/alexa-speakers/${PERSON_ID}`]: linked });
    const launch = await skill.invoke(launchRequest({ person: { personId: PERSON_ID } }));
    expect(ssml(launch)).toBe(`<speak>${SPEECH.whoIsSpeaking(["Stefan", "Julia"])}</speak>`);
    expect(launch.sessionAttributes).toMatchObject({ state: "AWAIT_SPEAKER" });

    const answer = await skill.invoke(intentRequest("SpeakerIntent", { member: { value: "julia", id: "JULIA" } }, { person: { personId: PERSON_ID }, session: launch.sessionAttributes ?? {} }));
    expect(linked).toHaveBeenCalledWith({ userId: "JULIA" }, `${API_BASE}/household/alexa-speakers/${encodeURIComponent(PERSON_ID)}`);
    expect(ssml(answer)).toBe(`<speak>${SPEECH.speakerSaved("Julia")}</speak>`);
    expect(answer.sessionAttributes?.state).toBeUndefined();
    expect(answer.sessionAttributes?.household).toMatchObject({ speakers: [{ personId: PERSON_ID, userId: "JULIA" }] });
    // The household context came from the session: one GET for the whole dialog.
    expect(api.calls.filter(([, init]) => (init.method ?? "GET") === "GET")).toHaveLength(1);
  });

  it("matches a spoken name without entity resolution", async () => {
    const { skill } = setup({ [`PUT /household/alexa-speakers/${PERSON_ID}`]: { data: CONTEXT } });
    const answer = await skill.invoke(intentRequest("SpeakerIntent", { member: { value: "Stefan" } }, { person: { personId: PERSON_ID } }));
    expect(ssml(answer)).toBe(`<speak>${SPEECH.speakerSaved("Stefan")}</speak>`);
  });

  it("asks again for an unknown name", async () => {
    const { skill, api } = setup();
    const answer = await skill.invoke(intentRequest("SpeakerIntent", { member: { value: "Oma" } }, { person: { personId: PERSON_ID } }));
    expect(ssml(answer)).toBe(`<speak>${SPEECH.speakerNotUnderstood(["Stefan", "Julia"])}</speak>`);
    expect(answer.sessionAttributes).toMatchObject({ state: "AWAIT_SPEAKER" });
    expect(api.calls.some(([, init]) => init.method === "PUT")).toBe(false);
  });

  it("explains voice profiles when no voice was recognized", async () => {
    const { skill } = setup();
    const answer = await skill.invoke(intentRequest("SpeakerIntent", { member: { value: "Julia" } }));
    expect(ssml(answer)).toBe(`<speak>${SPEECH.noVoiceProfile}</speak>`);
  });

  it("answers household-wide when the speaker is not recognized at all", async () => {
    const { skill } = setup();
    expect(ssml(await skill.invoke(launchRequest()))).toBe(`<speak>${SPEECH.welcome}</speak>`);
  });

  it("escapes member names in SSML", () => {
    expect(SPEECH.welcomeMember("Tom & Jerry")).toContain("Tom &amp; Jerry");
  });
});
