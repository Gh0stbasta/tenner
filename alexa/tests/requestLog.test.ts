/** ALEXA-009: one structured log line per request, without personal data. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSkill } from "../src/skill.js";
import { ACCOUNT_TOKEN, PERSON_ID, PERSON_TOKEN, SKILL_ID, intentRequest, launchRequest } from "./envelopes.js";
import { API_BASE, CONTEXT, fakeApi, type FakeRoute } from "./fakeApi.js";
import { KITCHEN_DAY } from "./dashboardFixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function capture(routes: Record<string, FakeRoute> = {}) {
  const lines: Record<string, unknown>[] = [];
  const push = (line: unknown) => lines.push(JSON.parse(String(line)) as Record<string, unknown>);
  vi.spyOn(console, "info").mockImplementation(push);
  vi.spyOn(console, "error").mockImplementation(push);
  const api = fakeApi({ "GET /dashboard": { data: KITCHEN_DAY }, "GET /tenners": { data: [{ tennerId: "mob", title: "Mobility", assignedTo: "STEFAN", assignmentMode: "FIXED", estimatedMinutes: 10, nextDue: "2026-01-01", pausedAt: null, active: true }] }, ...routes });
  const skill = createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch);
  const requests = () => lines.filter((line) => line.event === "skill_request");
  return { skill, lines, requests };
}

describe("request log (Log Fields Present, No Tokens Or Person IDs)", () => {
  it("logs request type, intent, locale, device, duration, API calls and outcome", async () => {
    const { skill, requests } = capture();
    await skill.invoke(intentRequest("TodayIntent"));
    expect(requests()).toEqual([
      expect.objectContaining({ level: "info", requestId: "amzn1.echo-api.request.test", requestType: "IntentRequest", intent: "TodayIntent", locale: "de-DE", device: "VOICE", apiCalls: 2, apiStatus: 200, outcome: "ASKED" }),
    ]);
    expect(requests()[0]?.durationMs).toEqual(expect.any(Number));
  });

  it("never logs tokens, person or account IDs or titles", async () => {
    const { skill, lines } = capture({ "GET /household/alexa": { data: { ...CONTEXT, speakers: [{ personId: PERSON_ID, userId: "STEFAN" }] } }, "POST /tenners/mob/complete": { data: { tenner: { tennerId: "mob", title: "Mobility", assignedTo: "STEFAN", assignmentMode: "FIXED", nextDue: "2026-10-12" }, completion: { completedBy: "STEFAN" } } } });
    await skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "mobility" } }, { person: { personId: PERSON_ID, accessToken: PERSON_TOKEN } }));
    const text = JSON.stringify(lines);
    for (const secret of [ACCOUNT_TOKEN, PERSON_TOKEN, PERSON_ID, "amzn1.ask.account", "Mobility"]) expect(text).not.toContain(secret);
  });
});

describe("outcomes (Metric Emission Per Outcome)", () => {
  it.each([
    ["ASKED", () => launchRequest(), {}],
    ["LINK_REQUIRED", () => launchRequest({ accessToken: null }), {}],
    ["ERROR", () => intentRequest("TodayIntent"), { "GET /dashboard": { status: 503 } }],
  ] as const)("%s", async (outcome, request, routes) => {
    const { skill, requests } = capture(routes as Record<string, FakeRoute>);
    await skill.invoke(request());
    expect(requests().map((line) => line.outcome)).toEqual([outcome]);
  });

  it("COMPLETED for a completion and records network errors as API status 0", async () => {
    const done = capture({ "POST /tenners/mob/complete": { data: { tenner: { tennerId: "mob", title: "Mobility", assignedTo: "STEFAN", assignmentMode: "FIXED", nextDue: "2026-10-12" }, completion: { completedBy: "STEFAN" } } } });
    await done.skill.invoke(intentRequest("CompleteIntent", { tenner: { value: "mobility" } }, { person: { personId: PERSON_ID, accessToken: PERSON_TOKEN } }));
    expect(done.requests()[0]).toMatchObject({ outcome: "COMPLETED" });
    const network = capture({ "GET /household/alexa": "network-error" });
    await network.skill.invoke(launchRequest());
    // The read is retried once (MAINT-001), so two calls without a response.
    expect(network.requests()[0]).toMatchObject({ outcome: "ERROR", apiStatus: 0, apiCalls: 2 });
  });

  it("names the device class on screen devices", async () => {
    const { skill, requests } = capture();
    const request = launchRequest({ supportedInterfaces: { "Alexa.Presentation.APL": {} } });
    (request.context as unknown as { Viewport: unknown }).Viewport = { shape: "RECTANGLE", pixelWidth: 1280, pixelHeight: 800, dpi: 160, currentPixelWidth: 1280, currentPixelHeight: 800, mode: "HUB" };
    await skill.invoke(request);
    expect(requests()[0]?.device).toBe("HUB-LANDSCAPE-LARGE");
  });
});
