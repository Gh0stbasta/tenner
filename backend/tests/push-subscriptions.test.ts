/** NOTIFICATION-009: browser push subscriptions and the Web Push channel. */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { ForbiddenError, ValidationError } from "../src/exceptions/index.js";
import { subscribePushHandler, unsubscribePushHandler } from "../src/handlers/notification-preferences.js";
import type { HouseholdSettings, PushSubscriptionRecord } from "../src/models/index.js";
import { WebPushChannel, payloadsOf, type PushOutcome } from "../src/push/index.js";
import { DynamoDbHouseholdRepository } from "../src/repositories/index.js";
import { PushSubscriptionService } from "../src/services/index.js";
import { householdSettings, mockLogger, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-07T08:00:00Z");
const P256DH = "B".repeat(87);
const AUTH = "a".repeat(22);
const device = (n: number, userId = "STEFAN"): PushSubscriptionRecord => ({ userId, endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, p256dh: P256DH, auth: AUTH, createdAt: `t${n}` });
const request = (n: number) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, expirationTime: null, keys: { p256dh: P256DH, auth: AUTH } });

function households(subscriptions: PushSubscriptionRecord[] = [], version = 0) {
  let settings: HouseholdSettings = householdSettings({ pushSubscriptions: subscriptions, pushSubscriptionsVersion: version });
  return {
    get current() {
      return settings;
    },
    get: vi.fn(async () => settings),
    savePushSubscriptions: vi.fn<(tenantId: string, list: readonly PushSubscriptionRecord[], expected: number, actor: string, timestamp: string) => Promise<HouseholdSettings>>(async (_tenantId, list, expected) => {
      settings = { ...settings, pushSubscriptions: list, pushSubscriptionsVersion: expected + 1 };
      return settings;
    }),
  };
}

describe("PushSubscriptionService", () => {
  it("registers a device of the member and refreshes an existing endpoint", async () => {
    const repo = households([device(1, "JULIA")], 3);
    const service = new PushSubscriptionService(repo, () => NOW);
    expect(await service.subscribe(TEST_IDENTITY, "STEFAN", request(2))).toBe(1);
    expect(repo.savePushSubscriptions).toHaveBeenCalledWith("default", [device(1, "JULIA"), { ...device(2), createdAt: "2026-10-07T08:00:00Z" }], 3, "STEFAN", "2026-10-07T08:00:00Z");
    expect(await service.subscribe(TEST_IDENTITY, "STEFAN", request(2))).toBe(1);
    expect(await service.subscriptionsOf("default", "STEFAN")).toHaveLength(1);
  });

  it("keeps at most 5 devices per member (oldest dropped) and never touches other members", async () => {
    const repo = households([device(1), device(2), device(3), device(4), device(5), device(9, "JULIA")], 1);
    const service = new PushSubscriptionService(repo, () => NOW);
    expect(await service.subscribe(TEST_IDENTITY, "STEFAN", request(6))).toBe(5);
    expect(repo.current.pushSubscriptions.map((subscription) => subscription.endpoint.slice(-1))).toEqual(["2", "3", "4", "5", "9", "6"]);
  });

  it("only the member manages their devices", async () => {
    const service = new PushSubscriptionService(households(), () => NOW);
    await expect(service.subscribe(TEST_IDENTITY, "JULIA", request(1))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.unsubscribe(TEST_IDENTITY, "JULIA", "https://x")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("removes a device, and gone endpoints of any member; no write when nothing matches", async () => {
    const repo = households([device(1), device(2, "JULIA")], 2);
    const service = new PushSubscriptionService(repo, () => NOW);
    await service.unsubscribe(TEST_IDENTITY, "STEFAN", "https://fcm.googleapis.com/fcm/send/1");
    expect(repo.current.pushSubscriptions).toEqual([device(2, "JULIA")]);
    await service.removeGone("default", "https://fcm.googleapis.com/fcm/send/2");
    expect(repo.current.pushSubscriptions).toEqual([]);
    expect(repo.savePushSubscriptions.mock.calls[1]?.[3]).toBe("SYSTEM");
    await service.removeGone("default", "https://unknown");
    expect(repo.savePushSubscriptions).toHaveBeenCalledTimes(2);
  });
});

describe("push subscription handlers", () => {
  const event = (body: unknown, userId = "STEFAN") => ({ body: JSON.stringify(body), isBase64Encoded: false, pathParameters: { userId } }) as unknown as APIGatewayProxyEventV2;

  it("registers with the browser's subscription JSON and logs only the push service host", async () => {
    const logger = mockLogger();
    const subscribe = vi.fn(async () => 2);
    const response = await subscribePushHandler(event(request(7)), TEST_IDENTITY, subscribe, logger);
    expect(JSON.parse(response.body ?? "").data).toEqual({ devices: 2 });
    expect(subscribe).toHaveBeenCalledWith(TEST_IDENTITY, "STEFAN", request(7));
    expect(logger.info).toHaveBeenCalledWith("Push device registered", { event: "PushSubscribed", userId: "STEFAN", devices: 2, pushService: "fcm.googleapis.com" });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("/send/7");
  });

  it.each([
    ["http endpoint", { ...request(1), endpoint: "http://push.example.com/x" }],
    ["short key", { ...request(1), keys: { p256dh: "abc", auth: AUTH } }],
    ["unknown field", { ...request(1), extra: 1 }],
  ])("rejects %s", async (_name, body) => {
    await expect(subscribePushHandler(event(body), TEST_IDENTITY, vi.fn(), mockLogger())).rejects.toBeInstanceOf(ValidationError);
  });

  it("removes a device by endpoint", async () => {
    const unsubscribe = vi.fn(async () => undefined);
    await unsubscribePushHandler(event({ endpoint: "https://fcm.googleapis.com/fcm/send/1" }), TEST_IDENTITY, unsubscribe, mockLogger());
    expect(unsubscribe).toHaveBeenCalledWith(TEST_IDENTITY, "STEFAN", "https://fcm.googleapis.com/fcm/send/1");
  });
});

describe("DynamoDbHouseholdRepository push subscriptions", () => {
  it("reads subscriptions and drops malformed entries", async () => {
    const client = { send: vi.fn(async () => ({ Item: { tenantId: "default", pushSubscriptionsVersion: 4, pushSubscriptions: [device(1), { ...device(2), userId: "bad id" }, { endpoint: "x" }] } })) };
    const settings = await new DynamoDbHouseholdRepository(client, "t").get("default");
    expect(settings?.pushSubscriptions).toEqual([device(1)]);
    expect(settings?.pushSubscriptionsVersion).toBe(4);
  });
});

describe("WebPushChannel", () => {
  const message = { type: "DAILY_DIGEST" as const, userId: "STEFAN", subject: "Heute: 2 Tenner", textBody: "x".repeat(400), deepLink: "https://app.example.com" };
  const recipient = { tenantId: "default", userId: "STEFAN", displayName: "Stefan", timezone: "Europe/Berlin" };
  const keys = { publicKey: "pub", privateKey: "priv", subject: "https://app.example.com" };

  function channel(subscriptions: PushSubscriptionRecord[], send = vi.fn(async (): Promise<PushOutcome> => ({ ok: true }))) {
    const removeGone = vi.fn(async () => undefined);
    return { removeGone, send, channel: new WebPushChannel({ subscriptionsOf: async () => subscriptions, removeGone, vapidKeys: async () => keys, appUrl: "https://app.example.com", now: () => NOW, send }) };
  }

  it("sends to every device with a shortened body", async () => {
    const { channel: push, send } = channel([device(1), device(2)]);
    expect(await push.send(message, recipient)).toEqual({ status: "SENT" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(device(1), { title: "Heute: 2 Tenner", body: `${"x".repeat(299)}…`, url: "https://app.example.com", tag: "DAILY_DIGEST" }, keys, { ttlSeconds: 43200, urgency: "normal" }, NOW);
  });

  it("skips members without a device and removes gone subscriptions", async () => {
    expect(await channel([]).channel.send(message, recipient)).toEqual({ status: "SKIPPED", errorCode: "NO_PUSH_DEVICE" });
    const gone = channel([device(1)], vi.fn(async (): Promise<PushOutcome> => ({ ok: false, status: 410, gone: true })));
    expect(await gone.channel.send(message, recipient)).toEqual({ status: "FAILED", errorCode: "PUSH_HTTP_410" });
    expect(gone.removeGone).toHaveBeenCalledWith("default", "https://fcm.googleapis.com/fcm/send/1");
  });

  it("falls back to the app URL and '/' for the link", () => {
    expect(payloadsOf({ ...message, textBody: "kurz", deepLink: undefined } as never, "https://app")[0]?.url).toBe("https://app");
    expect(payloadsOf({ ...message, textBody: "kurz", deepLink: undefined } as never, undefined)[0]?.url).toBe("/");
  });
});

describe("web push configuration", () => {
  it("needs the public key, the private key parameter and the app URL", () => {
    expect(loadConfig({ WEB_PUSH_PUBLIC_KEY: "pub", WEB_PUSH_PRIVATE_KEY_PARAMETER: "/tenner/prod/push/vapid-private-key", APP_URL: "https://app" }).webPush).toEqual({
      publicKey: "pub",
      privateKeyParameter: "/tenner/prod/push/vapid-private-key",
      subject: "https://app",
    });
    expect(loadConfig({ WEB_PUSH_PUBLIC_KEY: "pub", APP_URL: "https://app" }).webPush).toBeUndefined();
  });
});
