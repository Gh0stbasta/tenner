import { describe, expect, it } from "vitest";
import { handler } from "../src/index.js";
import { launchRequest } from "./envelopes.js";

describe("Lambda handler", () => {
  it("routes the event through the skill", async () => {
    const response = await handler(launchRequest());
    expect(response.version).toBe("1.0");
    expect(response.response.outputSpeech).toBeDefined();
  });
});
