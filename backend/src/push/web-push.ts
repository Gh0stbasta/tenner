/**
 * Web Push without a library (NOTIFICATION-009): payload encryption per RFC 8291 (aes128gcm, RFC 8188) and VAPID
 * authentication per RFC 8292 (ES256 JWT), using node:crypto only. Verified against the RFC 8291 test vector.
 */

import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";

/** One browser subscription (PushSubscription.toJSON()). */
export interface PushSubscriptionKeys {
  readonly endpoint: string;
  /** Base64url P-256 public key of the browser (65 bytes uncompressed). */
  readonly p256dh: string;
  /** Base64url 16-byte authentication secret. */
  readonly auth: string;
}

export interface VapidKeys {
  /** Base64url uncompressed P-256 public key (65 bytes), also given to the browser as applicationServerKey. */
  readonly publicKey: string;
  /** Base64url private scalar (32 bytes). */
  readonly privateKey: string;
  /** Contact for push services, "mailto:…" or an https URL (RFC 8292). */
  readonly subject: string;
}

const RECORD_SIZE = 4096;
const b64 = (value: string): Buffer => Buffer.from(value, "base64url");

/**
 * RFC 8291 message encryption. `salt` and `serverKeys` are random per message; tests pass fixed values.
 * Returns the aes128gcm body: salt (16) | record size (4) | key id length (1) | server public key (65) | ciphertext.
 */
export function encryptPayload(
  plaintext: Buffer,
  subscription: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  options: { readonly salt?: Buffer; readonly serverPrivateKey?: Buffer } = {},
): Buffer {
  const salt = options.salt ?? randomBytes(16);
  const ecdh = createECDH("prime256v1");
  if (options.serverPrivateKey) ecdh.setPrivateKey(options.serverPrivateKey);
  else ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey();
  const userAgentPublic = b64(subscription.p256dh);
  const sharedSecret = ecdh.computeSecret(userAgentPublic);

  // IKM = HKDF(auth, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), userAgentPublic, serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, b64(subscription.auth), keyInfo, 32));
  const contentKey = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  // Single record: plaintext followed by the 0x02 padding delimiter (last record).
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(serverPublic.length, 20);
  return Buffer.concat([header, serverPublic, ciphertext]);
}

/** RFC 8292 VAPID header value for the push service at `endpoint`, valid for 12 hours. */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, now: Date): string {
  const publicKey = b64(keys.publicKey);
  // The private scalar must be exactly 32 bytes (some generators drop leading zeros).
  const scalar = b64(keys.privateKey);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: Buffer.concat([Buffer.alloc(Math.max(0, 32 - scalar.length)), scalar]).toString("base64url"),
    x: publicKey.subarray(1, 33).toString("base64url"),
    y: publicKey.subarray(33, 65).toString("base64url"),
  };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = { aud: new URL(endpoint).origin, exp: Math.floor(now.getTime() / 1000) + 12 * 3600, sub: keys.subject };
  const unsigned = `${encode({ typ: "JWT", alg: "ES256" })}.${encode(claims)}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key: createPrivateKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${signature.toString("base64url")}, k=${keys.publicKey}`;
}

export type PushOutcome = { readonly ok: true } | { readonly ok: false; readonly status: number; readonly gone: boolean };

export interface PushRequestOptions {
  /** Seconds the push service keeps the message for an offline device. */
  readonly ttlSeconds: number;
  readonly urgency?: "very-low" | "low" | "normal" | "high";
  /** Replaces an undelivered message with the same topic (≤ 32 URL-safe characters). */
  readonly topic?: string;
}

/** Send one encrypted message. 404/410 mean the subscription is gone and should be deleted. */
export async function sendPush(
  subscription: PushSubscriptionKeys,
  payload: unknown,
  keys: VapidKeys,
  options: PushRequestOptions,
  now: Date,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<PushOutcome> {
  const body = encryptPayload(Buffer.from(JSON.stringify(payload)), subscription);
  const response = await fetchImpl(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, keys, now),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(options.ttlSeconds),
      Urgency: options.urgency ?? "normal",
      ...(options.topic === undefined ? {} : { Topic: options.topic }),
    },
    body,
  });
  if (response.ok) return { ok: true };
  return { ok: false, status: response.status, gone: response.status === 404 || response.status === 410 };
}
