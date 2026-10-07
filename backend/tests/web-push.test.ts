/** NOTIFICATION-009: Web Push encryption (RFC 8291) and VAPID (RFC 8292). */

import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { encryptPayload, sendPush, vapidAuthorization, type VapidKeys } from "../src/push/web-push.js";

// RFC 8291, Appendix A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

/** Decrypt as the browser does (receiver side of RFC 8291), to check round trips with random keys. */
function decrypt(body: Buffer, uaPrivate: Buffer, auth: Buffer): string {
  const salt = body.subarray(0, 16);
  const keyLength = body.readUInt8(20);
  const serverPublic = body.subarray(21, 21 + keyLength);
  const ciphertext = body.subarray(21 + keyLength);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const secret = ecdh.computeSecret(serverPublic);
  const ikm = Buffer.from(hkdfSync("sha256", secret, auth, Buffer.concat([Buffer.from("WebPush: info\0"), ecdh.getPublicKey(), serverPublic]), 32));
  const key = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = createDecipheriv("aes-128-gcm", key, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const padded = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
  return padded.subarray(0, padded.lastIndexOf(2)).toString();
}

function vapidKeys(): VapidKeys {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: ecdh.getPrivateKey().toString("base64url"), subject: "mailto:owner@example.com" };
}

describe("encryptPayload (RFC 8291)", () => {
  it("reproduces the RFC 8291 test vector", () => {
    const body = encryptPayload(Buffer.from(RFC.plaintext), { p256dh: RFC.uaPublic, auth: RFC.auth }, { salt: Buffer.from(RFC.salt, "base64url"), serverPrivateKey: Buffer.from(RFC.asPrivate, "base64url") });
    expect(body.toString("base64url")).toBe(RFC.body);
  });

  it("encrypts with fresh keys that the browser can decrypt", () => {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const auth = Buffer.from("0123456789abcdef");
    const first = encryptPayload(Buffer.from("Hallo Tenner"), { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") });
    const second = encryptPayload(Buffer.from("Hallo Tenner"), { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") });
    expect(decrypt(first, ua.getPrivateKey(), auth)).toBe("Hallo Tenner");
    expect(first.equals(second)).toBe(false);
  });
});

describe("vapidAuthorization (RFC 8292)", () => {
  it("signs an ES256 JWT for the push service origin, valid 12 hours", () => {
    const keys = vapidKeys();
    const now = new Date("2026-10-07T08:00:00Z");
    const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", keys, now);
    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header) ?? [];
    expect(k).toBe(keys.publicKey);
    const [head, claims, signature] = (token ?? "").split(".");
    expect(JSON.parse(Buffer.from(head ?? "", "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(Buffer.from(claims ?? "", "base64url").toString())).toEqual({ aud: "https://fcm.googleapis.com", exp: Math.floor(now.getTime() / 1000) + 12 * 3600, sub: "mailto:owner@example.com" });
    const raw = Buffer.from(keys.publicKey, "base64url");
    const publicKey = createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") }, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature ?? "", "base64url"))).toBe(true);
  });
});

describe("sendPush", () => {
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const subscription = { endpoint: "https://push.example.com/send/xyz", p256dh: ua.getPublicKey().toString("base64url"), auth: Buffer.from("0123456789abcdef").toString("base64url") };

  it("posts the encrypted payload with VAPID, TTL, urgency and topic", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    const outcome = await sendPush(subscription, { title: "Tenner" }, vapidKeys(), { ttlSeconds: 3600, urgency: "high", topic: "t-1" }, new Date(), fetchMock);
    expect(outcome).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(subscription.endpoint);
    expect(init.headers).toMatchObject({ "Content-Encoding": "aes128gcm", TTL: "3600", Urgency: "high", Topic: "t-1", Authorization: expect.stringMatching(/^vapid t=/) });
    expect(decrypt(init.body as Buffer, ua.getPrivateKey(), Buffer.from("0123456789abcdef"))).toBe('{"title":"Tenner"}');
  });

  it("reports gone subscriptions (404/410) and other failures", async () => {
    for (const [status, gone] of [[410, true], [404, true], [429, false], [500, false]] as const) {
      const outcome = await sendPush(subscription, {}, vapidKeys(), { ttlSeconds: 60 }, new Date(), vi.fn(async () => new Response(null, { status })));
      expect(outcome).toEqual({ ok: false, status, gone });
    }
  });
});
