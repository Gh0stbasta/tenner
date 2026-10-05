import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResponseEnvelope } from "ask-sdk-model";
import { loadConfig } from "../src/config.js";
import { createSkill } from "../src/skill.js";
import { SPEECH } from "../src/speech.js";
import { SKILL_ID, intentRequest, launchRequest, sessionEndedRequest, unknownRequest } from "./envelopes.js";

const skill = createSkill({ tennerApiBaseUrl: "", skillId: SKILL_ID });

function ssml(response: ResponseEnvelope): string | undefined {
  const speech = response.response.outputSpeech;
  return speech?.type === "SSML" ? speech.ssml : undefined;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Tenner skill (ALEXA-001)", () => {
  it("welcomes on launch and keeps the session open", async () => {
    const response = await skill.invoke(launchRequest());
    expect(ssml(response)).toBe(`<speak>${SPEECH.welcome}</speak>`);
    expect(response.response.reprompt).toBeDefined();
    expect(response.response.shouldEndSession).toBe(false);
  });

  it("explains itself on help", async () => {
    const response = await skill.invoke(intentRequest("AMAZON.HelpIntent"));
    expect(ssml(response)).toContain("Was ist heute fällig?");
    expect(response.response.shouldEndSession).toBe(false);
  });

  it.each(["AMAZON.StopIntent", "AMAZON.CancelIntent", "AMAZON.NavigateHomeIntent"])("ends the session on %s", async (name) => {
    const response = await skill.invoke(intentRequest(name));
    expect(ssml(response)).toBe(`<speak>${SPEECH.goodbye}</speak>`);
    expect(response.response.shouldEndSession).toBe(true);
  });

  it.each(["AMAZON.FallbackIntent", "SomeFutureIntent"])("answers %s with the fallback text", async (name) => {
    const response = await skill.invoke(intentRequest(name));
    expect(ssml(response)).toBe(`<speak>${SPEECH.fallback}</speak>`);
    expect(response.response.shouldEndSession).toBe(false);
  });

  it("returns an empty response for SessionEndedRequest and logs errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await skill.invoke(sessionEndedRequest("ERROR", { type: "INVALID_RESPONSE", message: "x" }));
    expect(response.response.outputSpeech).toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({ event: "session_ended", reason: "ERROR", errorType: "INVALID_RESPONSE" });
  });

  it("logs a normal session end as info", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await skill.invoke(sessionEndedRequest("USER_INITIATED"));
    expect(response.response.outputSpeech).toBeUndefined();
    expect(info).toHaveBeenCalledOnce();
  });

  it("answers unknown request types with a spoken error instead of failing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await skill.invoke(unknownRequest("Some.UnknownRequest"));
    expect(ssml(response)).toBe(`<speak>${SPEECH.error}</speak>`);
    expect(response.response.shouldEndSession).toBe(true);
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({ event: "skill_error", requestType: "Some.UnknownRequest" });
  });

  it("rejects requests for another skill ID without answering", async () => {
    await expect(skill.invoke(launchRequest("amzn1.ask.skill.other"))).rejects.toThrow("ID verification failed");
  });

  it("accepts any skill ID when none is configured", async () => {
    const open = createSkill({ tennerApiBaseUrl: "", skillId: undefined });
    const response = await open.invoke(launchRequest("amzn1.ask.skill.other"));
    expect(ssml(response)).toBe(`<speak>${SPEECH.welcome}</speak>`);
  });

  it("answers well inside the 8 second Alexa limit (no network call yet)", async () => {
    const started = performance.now();
    await skill.invoke(launchRequest());
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("loadConfig", () => {
  it("reads the API base URL without trailing slash and the skill ID", () => {
    expect(loadConfig({ TENNER_API_BASE_URL: "https://api.test/prod/", ALEXA_SKILL_ID: " amzn1.ask.skill.x " })).toEqual({
      tennerApiBaseUrl: "https://api.test/prod",
      skillId: "amzn1.ask.skill.x",
    });
  });

  it("treats a missing or blank skill ID as not configured", () => {
    expect(loadConfig({ ALEXA_SKILL_ID: "  " })).toEqual({ tennerApiBaseUrl: "", skillId: undefined });
  });
});
