/** ALEXA-008: reminders from skill messages and the reminder permission. */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestEnvelope } from "ask-sdk-model";
import { ENABLE_REMINDERS_SPEECH, REMINDERS_PERMISSION } from "../src/handlers/messaging.js";
import { createSkill } from "../src/skill.js";
import { SKILL_ID, envelope, intentRequest } from "./envelopes.js";
import { API_BASE } from "./fakeApi.js";
import { ssml } from "./ssml.js";

const message = (data: unknown, apiAccessToken: string | null = "api-token"): RequestEnvelope => {
  const request = envelope({ type: "Messaging.MessageReceived", message: data });
  if (apiAccessToken) (request.context.System as { apiAccessToken?: string }).apiAccessToken = apiAccessToken;
  return request;
};

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(status = 201) {
  const fetchMock = vi.fn(async () => new Response("{}", { status }));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  return { skill: createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, fetchMock as unknown as typeof fetch), fetchMock, error };
}

describe("reminders from skill messages", () => {
  it("creates a one-time reminder in 60 seconds with the request's API token (Briefing Reminder Created)", async () => {
    const { skill, fetchMock } = setup();
    const response = await skill.invoke(message({ type: "REMINDER", text: "Tenner: Heute 4 Tenner." }));
    expect(response.response.outputSpeech).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.eu.amazonalexa.com/v1/alerts/reminders");
    expect(init.headers).toMatchObject({ authorization: "Bearer api-token" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      trigger: { type: "SCHEDULED_RELATIVE", offsetInSeconds: 60 },
      alertInfo: { spokenInfo: { content: [{ locale: "de-DE", text: "Tenner: Heute 4 Tenner." }] } },
    });
  });

  it("logs a missing permission without IDs (Missing Permission → Request Flow)", async () => {
    const { skill, error } = setup(401);
    await skill.invoke(message({ type: "REMINDER", text: "x" }));
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({ event: "reminder_permission_missing", status: 401 });
    expect(JSON.stringify(error.mock.calls)).not.toContain("amzn1.ask.account");
  });

  it("ignores unknown messages and messages without token, and survives network errors", async () => {
    const { skill, fetchMock } = setup();
    await skill.invoke(message({ type: "OTHER" }));
    await skill.invoke(message({ type: "REMINDER", text: "x" }, null));
    expect(fetchMock).not.toHaveBeenCalled();
    const failing = createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, (async () => Promise.reject(new Error("net"))) as unknown as typeof fetch);
    expect((await failing.invoke(message({ type: "REMINDER", text: "x" }))).response.outputSpeech).toBeUndefined();
  });
});

describe("reminder permission", () => {
  it("asks for the reminder permission by voice", async () => {
    const { skill } = setup();
    const response = await skill.invoke(intentRequest("EnableRemindersIntent"));
    expect(ssml(response)).toBe(`<speak>${ENABLE_REMINDERS_SPEECH}</speak>`);
    expect(response.response.directives).toEqual([
      { type: "Connections.SendRequest", name: "AskFor", payload: { "@type": "AskForPermissionsConsentRequest", "@version": "1", permissionScope: REMINDERS_PERMISSION }, token: "" },
    ]);
  });

  it.each([
    ["ACCEPTED", "Danke."],
    ["DENIED", "Okay, dann erinnere ich dich nicht."],
  ])("answers the consent result %s", async (status, text) => {
    const { skill } = setup();
    const response = await skill.invoke(envelope({ type: "Connections.Response", name: "AskFor", status: { code: "200" }, payload: { permissionScope: REMINDERS_PERMISSION, status } }));
    expect(ssml(response)).toContain(text);
  });
});
