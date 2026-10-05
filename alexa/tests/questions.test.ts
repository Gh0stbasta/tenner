/** ALEXA-003 handlers: audience resolution, API call, session behavior, listing continuation. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSkill } from "../src/skill.js";
import { SPEECH } from "../src/speech.js";
import { KITCHEN_DAY, dashboard, dashboardTenner } from "./dashboardFixtures.js";
import { PERSON_ID, SKILL_ID, intentRequest, type EnvelopeOptions } from "./envelopes.js";
import { API_BASE, CONTEXT, fakeApi, type FakeRoute } from "./fakeApi.js";
import { ssml } from "./ssml.js";

function setup(routes: Record<string, FakeRoute> = {}) {
  const api = fakeApi({ "GET /dashboard": { data: KITCHEN_DAY }, ...routes });
  return { skill: createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch), api };
}

const julia: EnvelopeOptions = { person: { personId: PERSON_ID } };
const juliaContext = { data: { ...CONTEXT, speakers: [{ personId: PERSON_ID, userId: "JULIA" }] } };
const dashboardCalls = (calls: [string, RequestInit][]) => calls.map(([url]) => url).filter((url) => url.includes("/dashboard"));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TodayIntent", () => {
  it("asks for the speaker's own and shared Tenners (Today For Known Speaker)", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext, "GET /dashboard?assignedTo=JULIA": { data: dashboard() } });
    const response = await skill.invoke(intentRequest("TodayIntent", {}, julia));
    expect(dashboardCalls(api.calls)).toEqual([`${API_BASE}/dashboard?assignedTo=JULIA`]);
    expect(ssml(response)).toBe("<speak>Ein Tenner für dich heute, zusammen 10 Minuten: Büro saugen (10 Minuten).</speak>");
    expect(response.response.card).toMatchObject({ type: "Simple", title: "Tenner" });
  });

  it("answers household-wide without a recognized speaker (Today For Unknown Speaker)", async () => {
    const { skill, api } = setup();
    const response = await skill.invoke(intentRequest("TodayIntent"));
    expect(dashboardCalls(api.calls)).toEqual([`${API_BASE}/dashboard`]);
    expect(ssml(response)).toMatch(/^<speak>Vier Tenner heute/);
  });

  it("filters by a named member („für Julia“)", async () => {
    const { skill, api } = setup({ "GET /dashboard?assignedTo=JULIA": { data: dashboard() } });
    const response = await skill.invoke(intentRequest("TodayIntent", { member: { value: "julia", id: "JULIA" } }));
    expect(dashboardCalls(api.calls)).toEqual([`${API_BASE}/dashboard?assignedTo=JULIA`]);
    expect(ssml(response)).toMatch(/^<speak>Ein Tenner für Julia heute/);
  });

  it("treats the speaker's own name as „für dich“", async () => {
    const { skill } = setup({ "GET /household/alexa": juliaContext, "GET /dashboard?assignedTo=JULIA": { data: dashboard() } });
    const response = await skill.invoke(intentRequest("TodayIntent", { member: { value: "Julia" } }, julia));
    expect(ssml(response)).toMatch(/^<speak>Ein Tenner für dich heute/);
  });

  it("does not call the dashboard for an unknown name", async () => {
    const { skill, api } = setup();
    const response = await skill.invoke(intentRequest("TodayIntent", { member: { value: "Oma" } }));
    expect(ssml(response)).toBe(`<speak>${SPEECH.unknownMember("Oma", ["Stefan", "Julia"])}</speak>`);
    expect(dashboardCalls(api.calls)).toEqual([]);
  });

  it("ends a one-shot request and keeps an open session waiting", async () => {
    const { skill } = setup({ "GET /dashboard": { data: dashboard() } });
    const oneShot = await skill.invoke(intentRequest("TodayIntent"));
    expect(oneShot.response.shouldEndSession).toBe(true);
    const inSession = intentRequest("TodayIntent");
    (inSession.session as { new: boolean }).new = false;
    const open = await skill.invoke(inSession);
    expect(open.response.shouldEndSession).toBe(false);
    expect(open.response.reprompt).toBeDefined();
  });

  it("escapes titles in SSML but not in the card (SSML Escaping Of Titles)", async () => {
    const { skill } = setup({ "GET /dashboard": { data: dashboard({ dueToday: [dashboardTenner({ title: "Keller & <Garage>" })] }) } });
    const response = await skill.invoke(intentRequest("TodayIntent"));
    expect(ssml(response)).toContain("Keller &amp; &lt;Garage&gt;");
    expect(response.response.card).toMatchObject({ content: expect.stringContaining("Keller & <Garage>") });
  });

  it("maps API errors to speech (API Error Messages)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { skill } = setup({ "GET /dashboard": { status: 500, error: { code: "INTERNAL_ERROR" } } });
    expect(ssml(await skill.invoke(intentRequest("TodayIntent")))).toBe(`<speak>${SPEECH.unavailable}</speak>`);
  });
});

describe("listing continuation (Yes / No)", () => {
  it("reads the rest on „ja“ and stops on „nein“", async () => {
    const { skill } = setup();
    const first = await skill.invoke(intentRequest("TodayIntent"));
    expect(first.response.shouldEndSession).toBe(false);
    expect(first.sessionAttributes).toMatchObject({ listing: ["Spülmaschine ausräumen (10 Minuten)"] });

    const yes = intentRequest("AMAZON.YesIntent", {}, { session: first.sessionAttributes ?? {} });
    (yes.session as { new: boolean }).new = false;
    const more = await skill.invoke(yes);
    expect(ssml(more)).toBe("<speak>Weiter: Spülmaschine ausräumen (10 Minuten).</speak>");
    expect(more.sessionAttributes?.listing).toBeUndefined();

    const no = intentRequest("AMAZON.NoIntent", {}, { session: first.sessionAttributes ?? {} });
    (no.session as { new: boolean }).new = false;
    const stop = await skill.invoke(no);
    expect(ssml(stop)).toBe("<speak>Alles klar.</speak>");
    expect(stop.sessionAttributes?.listing).toBeUndefined();
  });

  it("treats „ja“ without a listing as not understood", async () => {
    const { skill } = setup();
    expect(ssml(await skill.invoke(intentRequest("AMAZON.YesIntent")))).toBe(`<speak>${SPEECH.fallback}</speak>`);
  });
});

describe("other questions", () => {
  it("OverdueIntent reads the longest overdue first", async () => {
    const { skill } = setup();
    expect(ssml(await skill.invoke(intentRequest("OverdueIntent")))).toBe(
      "<speak>Zwei Tenner sind überfällig: Haustür putzen (seit 4 Tagen) und Fenster putzen (seit gestern).</speak>",
    );
  });

  it("SuggestIntent remembers the suggested Tenner for „erledigt“", async () => {
    const { skill } = setup();
    const response = await skill.invoke(intentRequest("SuggestIntent"));
    expect(ssml(response)).toContain("Wie wäre es mit Haustür putzen?");
    expect(response.sessionAttributes).toMatchObject({ suggestedTennerId: "f" });
  });

  it("WorkLeftIntent splits per member", async () => {
    const { skill } = setup();
    expect(ssml(await skill.invoke(intentRequest("WorkLeftIntent")))).toContain("Davon Stefan 40 Minuten und Julia 45 Minuten.");
  });
});
