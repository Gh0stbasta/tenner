/** SECURITY-006: secret loader. */

import type { GetParameterCommand } from "@aws-sdk/client-ssm";
import { describe, expect, it, vi } from "vitest";
import { SECRET_PLACEHOLDER, SecretUnavailableError, createSecretLoader, secretParameterName } from "../src/secrets/index.js";

const MARKER = "s3cr3t-MARKER-value";

function fakeClient(responses: (() => Promise<unknown>)[]) {
  const send = vi.fn<(command: GetParameterCommand) => Promise<unknown>>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("no response");
    return next();
  });
  return { send };
}

const value = (v: string) => async () => ({ Parameter: { Value: v } });

describe("createSecretLoader", () => {
  it("reads with decryption and caches for the TTL (Secret Loader Caching)", async () => {
    let now = 0;
    const client = fakeClient([value(MARKER), value("rotated")]);
    const loader = createSecretLoader({ client, ttlMs: 1000, now: () => now });
    expect(await loader.get("/tenner/prod/alexa/lwa-client-secret")).toBe(MARKER);
    expect(await loader.get("/tenner/prod/alexa/lwa-client-secret")).toBe(MARKER);
    expect(client.send).toHaveBeenCalledOnce();
    expect(client.send.mock.calls[0]?.[0].input).toEqual({ Name: "/tenner/prod/alexa/lwa-client-secret", WithDecryption: true });
    now = 1001;
    expect(await loader.get("/tenner/prod/alexa/lwa-client-secret")).toBe("rotated");
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it("shares one request for concurrent reads", async () => {
    const client = fakeClient([value(MARKER)]);
    const loader = createSecretLoader({ client });
    expect(await Promise.all([loader.get("/a"), loader.get("/a")])).toEqual([MARKER, MARKER]);
    expect(client.send).toHaveBeenCalledOnce();
  });

  it("fails without leaking values and retries on the next call (Loader Failure Handling)", async () => {
    const denied = Object.assign(new Error(`AccessDenied for ${MARKER}`), { name: "AccessDeniedException" });
    const client = fakeClient([async () => Promise.reject(denied), value(MARKER)]);
    const loader = createSecretLoader({ client });
    const error = await loader.get("/a").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SecretUnavailableError);
    expect(String(error)).toBe("SecretUnavailableError: Secret /a is unavailable (AccessDeniedException).");
    expect(JSON.stringify(error)).not.toContain(MARKER);
    expect(await loader.get("/a")).toBe(MARKER);
  });

  it("rejects empty values and the Terraform placeholder", async () => {
    const loader = createSecretLoader({ client: fakeClient([value(""), value(SECRET_PLACEHOLDER), async () => ({})]) });
    await expect(loader.get("/a")).rejects.toThrow("empty");
    await expect(loader.get("/a")).rejects.toThrow("not set yet");
    await expect(loader.get("/a")).rejects.toThrow("empty");
  });

  it("never puts the value into errors or logs (No Secret Values In Logs)", async () => {
    const logs = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const loader = createSecretLoader({ client: fakeClient([value(MARKER)]) });
    await loader.get("/a");
    expect(JSON.stringify([...logs.mock.calls, ...errors.mock.calls])).not.toContain(MARKER);
    vi.restoreAllMocks();
  });

  it("builds names per the naming standard", () => {
    expect(secretParameterName("prod", "alexa", "lwa-client-secret")).toBe("/tenner/prod/alexa/lwa-client-secret");
  });
});
