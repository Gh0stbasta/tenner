/** ALEXA-006 handlers: rendering on screen devices only, session without open microphone, touch completion. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestEnvelope } from "ask-sdk-model";
import { createSkill } from "../src/skill.js";
import { KITCHEN_DAY, dashboard } from "./dashboardFixtures.js";
import { PERSON_ID, SKILL_ID, envelope, intentRequest, launchRequest, type EnvelopeOptions } from "./envelopes.js";
import { API_BASE, CONTEXT, fakeApi, type FakeRoute } from "./fakeApi.js";
import { ssml } from "./ssml.js";

const SCREEN = { supportedInterfaces: { "Alexa.Presentation.APL": { runtime: { maxVersion: "2023.2" } } } };
const julia: EnvelopeOptions = { ...SCREEN, person: { personId: PERSON_ID } };
const juliaContext = { data: { ...CONTEXT, speakers: [{ personId: PERSON_ID, userId: "JULIA" }] } };

function setup(routes: Record<string, FakeRoute> = {}) {
  const api = fakeApi({ "GET /dashboard": { data: KITCHEN_DAY }, "GET /tenners": { data: [] }, ...routes });
  return { skill: createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch), api };
}

const renderOf = (response: Awaited<ReturnType<ReturnType<typeof createSkill>["invoke"]>>) =>
  response.response.directives?.find((directive) => directive.type === "Alexa.Presentation.APL.RenderDocument") as
    | { token: string; datasources: { payload: { view: { banner?: string; title: string } } } }
    | undefined;

const touch = (args: unknown[], options: EnvelopeOptions = SCREEN): RequestEnvelope => {
  const request = envelope({ type: "Alexa.Presentation.APL.UserEvent", token: "tenner-dashboard", arguments: args }, options);
  (request.session as { new: boolean }).new = false;
  return request;
};

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("screen devices", () => {
  it("shows the dashboard on launch without an open microphone", async () => {
    const { skill } = setup();
    const response = await skill.invoke(launchRequest(SCREEN));
    expect(renderOf(response)?.token).toBe("tenner-dashboard");
    expect(response.response.reprompt).toBeUndefined();
    expect(response.response.shouldEndSession).toBeUndefined();
    expect(response.sessionAttributes).toMatchObject({ screen: { assignedTo: null } });
  });

  it("keeps voice-only devices unchanged (Voice-Only Devices Unaffected)", async () => {
    const { skill, api } = setup();
    const response = await skill.invoke(launchRequest());
    expect(renderOf(response)).toBeUndefined();
    expect(response.response.reprompt).toBeDefined();
    expect(api.calls.some(([url]) => url.includes("/dashboard"))).toBe(false);
    expect(renderOf(await skill.invoke(intentRequest("TodayIntent")))).toBeUndefined();
  });

  it("renders the dashboard for today and the list for overdue, keeping the view open", async () => {
    const { skill } = setup();
    const today = await skill.invoke(intentRequest("TodayIntent", {}, SCREEN));
    expect(renderOf(today)?.token).toBe("tenner-dashboard");
    const overdue = await skill.invoke(intentRequest("OverdueIntent", {}, SCREEN));
    expect(renderOf(overdue)).toMatchObject({ token: "tenner-list", datasources: { payload: { view: { title: "Überfällig" } } } });
    expect(overdue.response.shouldEndSession).toBeUndefined();
  });
});

describe("touch completion (Touch Complete Event → Completion)", () => {
  it("completes for the recognized speaker and refreshes the dashboard with a banner", async () => {
    const complete = vi.fn(() => ({ data: { tenner: { ...KITCHEN_DAY.dueToday[1], assignmentMode: "FIXED", nextDue: "2026-10-12" }, completion: { completedBy: "JULIA" } } }));
    const { skill, api } = setup({ "GET /household/alexa": juliaContext, "POST /tenners/b/complete": complete, "GET /dashboard": { data: dashboard() } });
    const response = await skill.invoke(touch(["complete", "b", "Altglas"], { ...julia, session: { screen: { assignedTo: null } } }));
    const post = api.calls.find(([, init]) => init.method === "POST");
    expect(post?.[0]).toBe(`${API_BASE}/tenners/b/complete`);
    expect(JSON.parse(String(post?.[1].body))).toEqual({ completedBy: "JULIA" });
    expect(post?.[1].headers).toMatchObject({ "idempotency-key": "amzn1.echo-api.request.test" });
    expect(ssml(response)).toBe("<speak>Erledigt: Altglas. Als Nächstes fällig am 12. Oktober.</speak>");
    expect(renderOf(response)?.datasources.payload.view.banner).toBe("✓ Erledigt: Altglas");
    expect(response.response.shouldEndSession).toBeUndefined();
  });

  it("asks who did it when nobody is recognized", async () => {
    const { skill } = setup();
    const response = await skill.invoke(touch(["complete", "b", "Altglas"]));
    expect(ssml(response)).toBe("<speak>Wer hat Altglas gemacht: Stefan oder Julia?</speak>");
    expect(response.sessionAttributes).toMatchObject({ pending: { kind: "askCompletedBy", tenner: { tennerId: "b" } } });
  });

  it("ignores unknown events", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { skill, api } = setup();
    await skill.invoke(touch(["somethingElse"]));
    expect(api.calls.some(([, init]) => init.method === "POST")).toBe(false);
  });

  it("still answers when the dashboard refresh fails", async () => {
    const { skill } = setup({
      "GET /household/alexa": juliaContext,
      "POST /tenners/b/complete": { data: { tenner: { ...KITCHEN_DAY.dueToday[1], assignmentMode: "FIXED", nextDue: "2026-10-12" }, completion: { completedBy: "JULIA" } } },
      "GET /dashboard": { status: 503, error: { code: "SERVICE_UNAVAILABLE" } },
    });
    const response = await skill.invoke(touch(["complete", "b", "Altglas"], { ...julia, session: { screen: { assignedTo: null } } }));
    expect(ssml(response)).toContain("Erledigt: Altglas");
    expect(renderOf(response)).toBeUndefined();
  });
});
