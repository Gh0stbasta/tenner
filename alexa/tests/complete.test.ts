/** ALEXA-004: voice completion and undo. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSkill } from "../src/skill.js";
import { SPEECH } from "../src/speech.js";
import type { TennerSummary } from "../src/tenners.js";
import { PERSON_ID, SKILL_ID, intentRequest, launchRequest, type EnvelopeOptions } from "./envelopes.js";
import { API_BASE, CONTEXT, fakeApi, type FakeRoute } from "./fakeApi.js";
import { ssml } from "./ssml.js";

const TODAY = "2026-10-05";
const tenner = (overrides: Partial<TennerSummary>): TennerSummary => ({
  tennerId: "t",
  title: "Titel",
  assignedTo: "STEFAN",
  assignmentMode: "FIXED",
  estimatedMinutes: 10,
  nextDue: TODAY,
  pausedAt: null,
  active: true,
  ...overrides,
});
const TENNERS = [
  tenner({ tennerId: "mob", title: "Mobility", assignedTo: "JULIA", estimatedMinutes: 15 }),
  tenner({ tennerId: "bs", title: "Büro saugen" }),
  tenner({ tennerId: "ba", title: "Büro aufräumen" }),
  tenner({ tennerId: "pfl", title: "Pflanzen gießen", assignedTo: "JULIA", assignmentMode: "ROTATING" }),
  tenner({ tennerId: "auto", title: "Auto waschen", nextDue: "2026-10-12" }),
  tenner({ tennerId: "pool", title: "Pool reinigen", pausedAt: "2026-10-01T10:00:00Z" }),
];

const julia: EnvelopeOptions = { person: { personId: PERSON_ID } };
const juliaContext = { data: { ...CONTEXT, speakers: [{ personId: PERSON_ID, userId: "JULIA" }] } };

/** Completion echo: the Tenner moves on 7 days; rotating Tenners go to the other member. */
const completeRoute = (id: string): FakeRoute => (body) => {
  const original = TENNERS.find((candidate) => candidate.tennerId === id) as TennerSummary;
  const completedBy = (body as { completedBy: string }).completedBy;
  const assignedTo = original.assignmentMode === "ROTATING" ? (completedBy === "JULIA" ? "STEFAN" : "JULIA") : original.assignedTo;
  return { data: { tenner: { ...original, nextDue: "2026-10-12", pausedAt: null, assignedTo }, completion: { completedBy } } };
};

function setup(routes: Record<string, FakeRoute> = {}) {
  const api = fakeApi({
    "GET /tenners": { data: TENNERS },
    ...Object.fromEntries(TENNERS.map((candidate) => [`POST /tenners/${candidate.tennerId}/complete`, completeRoute(candidate.tennerId)])),
    ...routes,
  });
  return { skill: createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch), api };
}

const posts = (calls: [string, RequestInit][]) => calls.filter(([, init]) => init.method === "POST");
const bodyOf = (call: [string, RequestInit] | undefined) => JSON.parse(String(call?.[1].body));

/** Continue a dialog: same session attributes, not a new session. */
function followUp(name: string, slots: Parameters<typeof intentRequest>[1], session: Record<string, unknown> | undefined, options: EnvelopeOptions = {}) {
  const request = intentRequest(name, slots, { ...options, session: session ?? {} });
  (request.session as { new: boolean }).new = false;
  return request;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T08:00:00Z`));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CompleteIntent", () => {
  it("completes an exact match for the recognized speaker with the request ID as idempotency key (Exact Match Completes)", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext });
    const response = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "mobility" } }, julia));
    const [call] = posts(api.calls);
    expect(call?.[0]).toBe(`${API_BASE}/tenners/mob/complete`);
    expect(bodyOf(call)).toEqual({ completedBy: "JULIA" });
    expect(call?.[1].headers).toMatchObject({ "idempotency-key": "amzn1.echo-api.request.test" });
    expect(ssml(response)).toBe("<speak>Erledigt: Mobility. Als Nächstes fällig am 12. Oktober.</speak>");
    expect(response.sessionAttributes).toMatchObject({ lastCompleted: { tennerId: "mob", title: "Mobility" } });
  });

  it("uses the entity resolution ID directly", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext });
    await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "irgendwas", id: "bs" } }, julia));
    expect(posts(api.calls)[0]?.[0]).toBe(`${API_BASE}/tenners/bs/complete`);
  });

  it("matches fuzzy speech (Fuzzy Match)", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext });
    await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "die pflanzen giessen" } }, julia));
    expect(posts(api.calls)[0]?.[0]).toBe(`${API_BASE}/tenners/pfl/complete`);
  });

  it("adds who is next for rotating Tenners (Rotation Hint)", async () => {
    const { skill } = setup({ "GET /household/alexa": juliaContext });
    const response = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "pflanzen gießen" } }, julia));
    expect(ssml(response)).toBe("<speak>Erledigt: Pflanzen gießen. Als Nächstes fällig am 12. Oktober. Nächstes Mal ist Stefan dran.</speak>");
  });

  it("asks between close candidates and completes the chosen one (Ambiguous Match Asks)", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext });
    const question = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "büro" } }, julia));
    expect(ssml(question)).toBe("<speak>Meinst du Büro aufräumen oder Büro saugen?</speak>");
    expect(posts(api.calls)).toHaveLength(0);
    expect(question.response.shouldEndSession).toBe(false);

    // The NLU may route the bare answer to SpeakerIntent: it is still read as a title.
    const choice = await skill.invoke(followUp("SpeakerIntent", { member: { value: "büro aufräumen" } }, question.sessionAttributes, julia));
    expect(posts(api.calls)[0]?.[0]).toBe(`${API_BASE}/tenners/ba/complete`);
    expect(ssml(choice)).toMatch(/^<speak>Erledigt: Büro aufräumen\./);
  });

  it("asks again when nothing matches (No Match Asks)", async () => {
    const { skill, api } = setup();
    const response = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "steuererklärung" } }));
    expect(ssml(response)).toBe(`<speak>${SPEECH.noTennerFound("steuererklärung")}</speak>`);
    expect(response.response.shouldEndSession).toBe(false);
    expect(posts(api.calls)).toHaveLength(0);
  });

  it("confirms Tenners that are not due yet (Not-Yet-Due Confirmation)", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext });
    const question = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "auto waschen" } }, julia));
    expect(ssml(question)).toBe("<speak>Auto waschen erledigen? Die ist erst am 12. Oktober fällig.</speak>");
    expect(posts(api.calls)).toHaveLength(0);
    await skill.invoke(followUp("AMAZON.YesIntent", {}, question.sessionAttributes, julia));
    expect(posts(api.calls)[0]?.[0]).toBe(`${API_BASE}/tenners/auto/complete`);
  });

  it("confirms paused Tenners and does nothing on „nein“ (Inactive And Paused Tenners)", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext });
    const question = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "pool reinigen" } }, julia));
    expect(ssml(question)).toContain(SPEECH.pausedWarning);
    const no = await skill.invoke(followUp("AMAZON.NoIntent", {}, question.sessionAttributes, julia));
    expect(ssml(no)).toBe(`<speak>${SPEECH.nothingChanged}</speak>`);
    expect(no.sessionAttributes?.pending).toBeUndefined();
    expect(posts(api.calls)).toHaveLength(0);
  });

  it("explains an inactive Tenner instead of failing", async () => {
    const { skill } = setup({ "GET /household/alexa": juliaContext, "POST /tenners/mob/complete": { status: 409, error: { code: "TENNER_INACTIVE" } } });
    const response = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "mobility" } }, julia));
    expect(ssml(response)).toBe(`<speak>${SPEECH.cannotComplete("Mobility")}</speak>`);
  });

  it("asks who did it when the speaker is unknown (Completed By Asked Speaker)", async () => {
    const { skill, api } = setup();
    const question = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "mobility" } }));
    expect(ssml(question)).toBe("<speak>Wer hat Mobility gemacht: Stefan oder Julia?</speak>");
    const unclear = await skill.invoke(followUp("SpeakerIntent", { member: { value: "oma" } }, question.sessionAttributes));
    expect(ssml(unclear)).toBe(ssml(question));
    await skill.invoke(followUp("CompleteIntent", { tenner: { value: "julia" } }, unclear.sessionAttributes));
    expect(bodyOf(posts(api.calls)[0])).toEqual({ completedBy: "JULIA" });
  });

  it("does not ask in a one-member household", async () => {
    const { skill, api } = setup({ "GET /household/alexa": { data: { ...CONTEXT, members: [{ userId: "STEFAN", displayName: "Stefan" }] } } });
    await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "mobility" } }));
    expect(bodyOf(posts(api.calls)[0])).toEqual({ completedBy: "STEFAN" });
  });

  it("completes the suggested Tenner on a bare „erledigt“", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext });
    await skill.invoke(followUp("CompleteIntent", {}, { suggestedTennerId: "bs" }, julia));
    expect(posts(api.calls)[0]?.[0]).toBe(`${API_BASE}/tenners/bs/complete`);
  });

  it("asks which Tenner on a bare „erledigt“ without context", async () => {
    const { skill } = setup();
    expect(ssml(await skill.invoke(intentRequest("CompleteIntent")))).toBe(`<speak>${SPEECH.whichTenner}</speak>`);
  });
});

describe("UndoIntent", () => {
  it("undoes the session's last completion directly (Undo In Session)", async () => {
    const { skill, api } = setup({ "GET /household/alexa": juliaContext, "POST /tenners/mob/undo-completion": { data: { tenner: TENNERS[0] } } });
    const done = await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "mobility" } }, julia));
    const undo = await skill.invoke(followUp("UndoIntent", {}, done.sessionAttributes, julia));
    const call = posts(api.calls)[1];
    expect(call?.[0]).toBe(`${API_BASE}/tenners/mob/undo-completion`);
    expect(call?.[1].headers).toMatchObject({ "idempotency-key": "amzn1.echo-api.request.test" });
    expect(ssml(undo)).toBe(`<speak>${SPEECH.undone("Mobility")}</speak>`);
    expect(undo.sessionAttributes?.lastCompleted).toBeUndefined();
  });

  it("finds today's latest completion of the speaker and asks first (Undo Outside Session With Confirmation)", async () => {
    const { skill, api } = setup({
      "GET /household/alexa": juliaContext,
      "GET /history?limit=1&completedBy=JULIA": { data: { items: [{ tennerId: "pfl", tennerTitle: "Pflanzen gießen", completedBy: "JULIA", completedAt: `${TODAY}T07:00:00Z` }] } },
      "POST /tenners/pfl/undo-completion": { data: { tenner: TENNERS[3] } },
    });
    const question = await skill.invoke(intentRequest("UndoIntent", {}, julia));
    expect(ssml(question)).toBe("<speak>Die letzte Erledigung heute war Pflanzen gießen. Soll ich sie rückgängig machen?</speak>");
    expect(posts(api.calls)).toHaveLength(0);
    const yes = await skill.invoke(followUp("AMAZON.YesIntent", {}, question.sessionAttributes, julia));
    expect(posts(api.calls)[0]?.[0]).toBe(`${API_BASE}/tenners/pfl/undo-completion`);
    expect(ssml(yes)).toBe(`<speak>${SPEECH.undone("Pflanzen gießen")}</speak>`);
  });

  it("names the member for household-wide undo and ignores older completions", async () => {
    const { skill } = setup({ "GET /history?limit=1": { data: { items: [{ tennerId: "bs", tennerTitle: "Büro saugen", completedBy: "STEFAN", completedAt: `${TODAY}T06:00:00Z` }] } } });
    expect(ssml(await skill.invoke(intentRequest("UndoIntent")))).toContain("Büro saugen von Stefan");
    const old = setup({ "GET /history?limit=1": { data: { items: [{ tennerId: "bs", tennerTitle: "Büro saugen", completedBy: "STEFAN", completedAt: "2026-10-03T06:00:00Z" }] } } });
    expect(ssml(await old.skill.invoke(intentRequest("UndoIntent")))).toBe(`<speak>${SPEECH.nothingToUndo}</speak>`);
    const none = setup({ "GET /history?limit=1": { data: { items: [] } } });
    expect(ssml(await none.skill.invoke(intentRequest("UndoIntent")))).toBe(`<speak>${SPEECH.nothingToUndo}</speak>`);
  });

  it("explains when there is nothing left to undo", async () => {
    const { skill } = setup({ "POST /tenners/mob/undo-completion": { status: 409, error: { code: "NO_COMPLETION_TO_UNDO" } } });
    const response = await skill.invoke(followUp("UndoIntent", {}, { lastCompleted: { tennerId: "mob", title: "Mobility" } }));
    expect(ssml(response)).toBe(`<speak>${SPEECH.noCompletionToUndo("Mobility")}</speak>`);
  });
});

describe("launch entities", () => {
  it("loads Tenner titles as dynamic entities with an article-free synonym", async () => {
    const { skill } = setup({ "GET /tenners": { data: [tenner({ tennerId: "x", title: "Die Fenster putzen" })] } });
    const response = await skill.invoke(launchRequest());
    expect(response.response.directives?.[0]).toMatchObject({
      types: [{ name: "TennerMember" }, { name: "TennerTitle", values: [{ id: "x", name: { value: "Die Fenster putzen", synonyms: ["fenster putzen"] } }] }],
    });
  });
});
