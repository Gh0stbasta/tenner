/** MAINT-001: time budget per request and one retry for reads without a response. */

import { describe, expect, it } from "vitest";
import { createTennerApi, TennerApiError } from "../src/tennerApi.js";

type Step = { delayMs: number } | "fail";

/** Fetch that answers each call after the given delay (or fails at once), honouring the abort signal. */
function scriptedFetch(steps: Step[]) {
  const calls: { method: string; path: string }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ method: String(init.method), path: new URL(url).pathname });
    const step = steps.shift() ?? { delayMs: 0 };
    if (step === "fail") throw new TypeError("fetch failed");
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response(JSON.stringify({ success: true, data: { ok: true } }), { status: 200 })), step.delayMs);
      init.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "TimeoutError"));
      });
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function client(steps: Step[], options: { timeoutMs?: number; budgetMs?: number; minRetryMs?: number } = {}) {
  const { fetchImpl, calls } = scriptedFetch(steps);
  const log: number[] = [];
  const api = createTennerApi({
    baseUrl: "https://api.test/prod",
    token: "token",
    correlationId: "req-1",
    timeoutMs: options.timeoutMs ?? 400,
    deadline: Date.now() + (options.budgetMs ?? 1000),
    minRetryMs: options.minRetryMs ?? 100,
    fetch: fetchImpl,
    onCall: (status) => log.push(status),
  });
  return { api, calls, log };
}

describe("Tenner API time budget (MAINT-001)", () => {
  it("lets a slow first call finish when it fits the attempt limit", async () => {
    const { api, log } = client([{ delayMs: 250 }]);
    await expect(api.request("GET", "/household/alexa")).resolves.toEqual({ ok: true });
    expect(log).toEqual([200]);
  });

  it("retries a read once when it got no response", async () => {
    const { api, calls, log } = client(["fail", { delayMs: 10 }]);
    await expect(api.request("GET", "/dashboard")).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(log).toEqual([0, 200]);
  });

  it("retries a timed-out read with the time that is left", async () => {
    const { api, log } = client([{ delayMs: 1000 }, { delayMs: 10 }], { timeoutMs: 300, budgetMs: 800 });
    await expect(api.request("GET", "/dashboard")).resolves.toEqual({ ok: true });
    expect(log).toEqual([0, 200]);
  });

  it("does not retry writes", async () => {
    const { api, calls } = client(["fail", { delayMs: 10 }]);
    await expect(api.request("POST", "/tenners/t-1/complete", {})).rejects.toMatchObject({ kind: "UNAVAILABLE", code: "NETWORK" });
    expect(calls).toHaveLength(1);
  });

  it("does not retry when too little budget is left, and never runs past the deadline", async () => {
    const { api, calls } = client([{ delayMs: 1000 }, { delayMs: 10 }], { timeoutMs: 400, budgetMs: 450, minRetryMs: 100 });
    const started = performance.now();
    await expect(api.request("GET", "/dashboard")).rejects.toBeInstanceOf(TennerApiError);
    expect(calls).toHaveLength(1);
    expect(performance.now() - started).toBeLessThan(600);
    const late = client([{ delayMs: 10 }], { budgetMs: -1 });
    await expect(late.api.request("GET", "/dashboard")).rejects.toMatchObject({ code: "NETWORK" });
    expect(late.calls).toHaveLength(0);
  });
});
