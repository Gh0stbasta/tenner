/** NOTIFICATION-009/011: public/push-sw.js, run against a fake service worker scope. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const code = readFileSync(resolve(process.cwd(), "public/push-sw.js"), "utf8");

function worker(fetchImpl: (url: string, init: RequestInit) => Promise<Response> = async () => new Response("{}")) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const client = {
    url: "https://app.example/dashboard",
    focus: vi.fn(async () => undefined),
    navigate: vi.fn(async () => undefined),
  };
  const scope = {
    location: { origin: "https://app.example" },
    addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener),
    registration: { showNotification: vi.fn(async () => undefined) },
    clients: { matchAll: vi.fn(async () => [] as (typeof client)[]), openWindow: vi.fn(async () => undefined) },
  };
  const fetchMock = vi.fn(fetchImpl);
  new Function("self", "fetch", code)(scope, fetchMock);
  const dispatch = async (type: string, event: Record<string, unknown>) => {
    let pending: Promise<unknown> = Promise.resolve();
    listeners[type]?.({ ...event, waitUntil: (promise: Promise<unknown>) => (pending = promise) });
    await pending;
  };
  return { scope, client, fetchMock, dispatch };
}

const payload = {
  title: "🏠 Tenner",
  body: "Heute: Kleines Bad\nGeschätzter Aufwand: 10 Minuten",
  url: "https://app.example/tenners/t-1",
  tag: "tenner-t-1",
  tennerId: "t-1",
  actionUrl: "https://api.example/prod/push-actions",
  actions: [
    { action: "done", title: "✅ Erledigt", token: "tok-done" },
    { action: "snooze", title: "⏰ Später", token: "tok-snooze" },
  ],
};

const notification = (data: unknown, tag = "tenner-t-1") => ({ tag, data, close: vi.fn() });

describe("push service worker", () => {
  it("shows the notification with its buttons and keeps the tokens in the data", async () => {
    const { scope, dispatch } = worker();
    await dispatch("push", { data: { json: () => payload } });
    expect(scope.registration.showNotification).toHaveBeenCalledWith(
      "🏠 Tenner",
      expect.objectContaining({
        body: payload.body,
        tag: "tenner-t-1",
        actions: [
          { action: "done", title: "✅ Erledigt" },
          { action: "snooze", title: "⏰ Später" },
        ],
        data: { url: payload.url, actionUrl: payload.actionUrl, tokens: { done: "tok-done", snooze: "tok-snooze" } },
      }),
    );
  });

  it("falls back to plain text for non-JSON pushes", async () => {
    const { scope, dispatch } = worker();
    await dispatch("push", { data: { json: () => JSON.parse("x"), text: () => "Hallo" } });
    expect(scope.registration.showNotification).toHaveBeenCalledWith(
      "Tenner",
      expect.objectContaining({ body: "Hallo", actions: [] }),
    );
  });

  it("„Erledigt“ posts the token and confirms without opening the app", async () => {
    const { scope, fetchMock, dispatch } = worker(async () =>
      Response.json({ success: true, data: { action: "DONE", result: "COMPLETED", title: "Kleines Bad" } }),
    );
    const data = { url: payload.url, actionUrl: payload.actionUrl, tokens: { done: "tok-done", snooze: "tok-snooze" } };
    await dispatch("notificationclick", { action: "done", notification: notification(data) });
    expect(fetchMock).toHaveBeenCalledWith(
      payload.actionUrl,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "tok-done" }) }),
    );
    expect(scope.registration.showNotification).toHaveBeenCalledWith(
      "Tenner",
      expect.objectContaining({ body: "✅ Erledigt: Kleines Bad", tag: "tenner-t-1" }),
    );
    expect(scope.clients.openWindow).not.toHaveBeenCalled();
  });

  it("„Später“ confirms the time; already done is fine", async () => {
    const snoozed = worker(async () =>
      Response.json({ data: { action: "SNOOZE", result: "SNOOZED", remindAt: "2026-10-07T16:00:00Z" } }),
    );
    await snoozed.dispatch("notificationclick", {
      action: "snooze",
      notification: notification({ url: "/", actionUrl: "https://api/x", tokens: { snooze: "t" } }),
    });
    expect(snoozed.scope.registration.showNotification).toHaveBeenCalledWith(
      "Tenner",
      expect.objectContaining({ body: expect.stringMatching(/^⏰ Erinnere dich um \d\d:\d\d Uhr wieder\.$/) }),
    );
    const done = worker(async () => Response.json({ data: { action: "DONE", result: "ALREADY_DONE", title: null } }));
    await done.dispatch("notificationclick", {
      action: "done",
      notification: notification({ url: "/", actionUrl: "https://api/x", tokens: { done: "t" } }),
    });
    expect(done.scope.registration.showNotification).toHaveBeenCalledWith(
      "Tenner",
      expect.objectContaining({ body: "✅ War schon erledigt." }),
    );
  });

  it("opens the Tenner when the action fails, has no token, or on a plain tap", async () => {
    const failing = worker(async () => new Response("{}", { status: 401 }));
    await failing.dispatch("notificationclick", {
      action: "done",
      notification: notification({ url: "/tenners/t-1", actionUrl: "https://api/x", tokens: { done: "t" } }),
    });
    expect(failing.scope.clients.openWindow).toHaveBeenCalledWith("https://app.example/tenners/t-1");
    const offline = worker(async () => Promise.reject(new TypeError("offline")));
    await offline.dispatch("notificationclick", {
      action: "snooze",
      notification: notification({ url: "/x", actionUrl: "https://api/x", tokens: { snooze: "t" } }),
    });
    expect(offline.scope.clients.openWindow).toHaveBeenCalledWith("https://app.example/x");
    const noToken = worker();
    await noToken.dispatch("notificationclick", {
      action: "done",
      notification: notification({ url: "/y", tokens: {} }),
    });
    expect(noToken.fetchMock).not.toHaveBeenCalled();
    const tap = worker();
    tap.scope.clients.matchAll.mockResolvedValue([tap.client]);
    await tap.dispatch("notificationclick", { action: "", notification: notification({ url: "/tenners/t-2" }) });
    expect(tap.client.focus).toHaveBeenCalled();
    expect(tap.client.navigate).toHaveBeenCalledWith("https://app.example/tenners/t-2");
  });
});
