/** MAINT-004: system messages (widget loading) are logged, not counted as skill errors. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSkill } from "../src/skill.js";
import { SKILL_ID, envelope } from "./envelopes.js";
import { API_BASE, fakeApi } from "./fakeApi.js";
import { KITCHEN_DAY } from "./dashboardFixtures.js";

function run(request: Record<string, unknown>) {
  const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const skill = createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, fakeApi().fetch);
  const invocation = envelope(request);
  delete (invocation as { session?: unknown }).session;
  return { response: skill.invoke(invocation), info, error };
}

const lines = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);

describe("system messages (MAINT-004)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs APL runtime errors of the widget without a skill error", async () => {
    const { response, info, error } = run({
      type: "Alexa.Presentation.APL.RuntimeError",
      token: "widget",
      errors: [{ type: "LINK_ERROR", reason: "INVALID_DATA_BINDING", message: "x".repeat(500) }],
    });
    expect((await response).response.outputSpeech).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
    const logged = lines(info);
    expect(logged.find((line) => line.event === "apl_runtime_error")).toMatchObject({ errors: [{ type: "LINK_ERROR", reason: "INVALID_DATA_BINDING" }] });
    expect(JSON.stringify(logged)).not.toContain("x".repeat(201));
    expect(logged.find((line) => line.event === "skill_request")).toMatchObject({ outcome: "ANSWERED" });
  });

  it("logs Data Store errors with the type only", async () => {
    const { response, info, error } = run({ type: "Alexa.DataStore.Error", error: { type: "DEVICE_UNAVAILABLE", content: { commands: [{ content: { title: "secret" } }] } } });
    await response;
    expect(error).not.toHaveBeenCalled();
    expect(lines(info).find((line) => line.event === "datastore_error")).toMatchObject({ errorType: "DEVICE_UNAVAILABLE" });
    expect(JSON.stringify(lines(info))).not.toContain("secret");
  });

  it("answers any other system message quietly but still sends unknown intents to the error path", async () => {
    const other = run({ type: "Alexa.Presentation.APL.LoadIndexListData" });
    expect((await other.response).response.outputSpeech).toBeUndefined();
    expect(other.error).not.toHaveBeenCalled();
    expect(lines(other.info).find((line) => line.event === "unhandled_request")).toMatchObject({ requestType: "Alexa.Presentation.APL.LoadIndexListData" });
    vi.restoreAllMocks();
    const intent = run({ type: "IntentRequest", intent: { name: "UnknownIntent", confirmationStatus: "NONE" } });
    await intent.response;
    expect(lines(intent.error).some((line) => line.event === "skill_error")).toBe(true);
  });

  it("opens the dashboard when a widget tap arrives without a session", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = fakeApi({ "GET /dashboard": { data: KITCHEN_DAY }, "GET /tenners": { data: [] } });
    const skill = createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch);
    const tap = envelope(
      { type: "Alexa.Presentation.APL.UserEvent", arguments: ["openDashboard"] },
      { supportedInterfaces: { "Alexa.Presentation.APL": { runtime: { maxVersion: "2023.2" } } } },
    );
    delete (tap as { session?: unknown }).session;
    const response = await skill.invoke(tap);
    expect(error).not.toHaveBeenCalled();
    expect(response.response.directives?.some((directive) => directive.type === "Alexa.Presentation.APL.RenderDocument")).toBe(true);
  });
});
