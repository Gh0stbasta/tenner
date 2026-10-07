/**
 * Signed action links in push notifications (NOTIFICATION-011): „Erledigt“ and „Später“ work without opening the app.
 * A token names exactly one member, one Tenner, its due date (cycle) and one action, expires after 24 hours and is
 * signed with HMAC-SHA256 (secret in Parameter Store). It grants nothing else; the API re-checks member and Tenner.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PUSH_ACTIONS = ["DONE", "SNOOZE"] as const;
export type PushAction = (typeof PUSH_ACTIONS)[number];

export const ACTION_TOKEN_TTL_SECONDS = 24 * 3600;

export interface ActionClaims {
  readonly tenantId: string;
  readonly userId: string;
  readonly tennerId: string;
  /** The Tenner's due date when the notification was sent; a later cycle is not touched. */
  readonly nextDue: string;
  readonly action: PushAction;
  /** Epoch seconds. */
  readonly exp: number;
  /** Random ID; the Idempotency-Key of a completion. */
  readonly id: string;
}

export class InvalidActionTokenError extends Error {
  constructor(readonly reason: "MALFORMED" | "SIGNATURE" | "EXPIRED") {
    super(`Invalid action token: ${reason}.`);
    this.name = "InvalidActionTokenError";
  }
}

const hmac = (secret: string, data: string): Buffer => createHmac("sha256", secret).update(data).digest();

export function signActionToken(claims: Omit<ActionClaims, "exp" | "id">, secret: string, now: Date, id: string = randomBytes(16).toString("base64url")): string {
  const full: ActionClaims = { ...claims, exp: Math.floor(now.getTime() / 1000) + ACTION_TOKEN_TTL_SECONDS, id };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${payload}.${hmac(secret, payload).toString("base64url")}`;
}

/** The claims of a valid token; InvalidActionTokenError otherwise (constant-time signature check). */
export function verifyActionToken(token: string, secret: string, now: Date): ActionClaims {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) throw new InvalidActionTokenError("MALFORMED");
  const expected = hmac(secret, payload);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new InvalidActionTokenError("SIGNATURE");
  let claims: Partial<ActionClaims>;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<ActionClaims>;
  } catch {
    throw new InvalidActionTokenError("MALFORMED");
  }
  const { tenantId, userId, tennerId, nextDue, action, exp, id } = claims;
  if (
    typeof tenantId !== "string" ||
    typeof userId !== "string" ||
    typeof tennerId !== "string" ||
    typeof nextDue !== "string" ||
    typeof exp !== "number" ||
    typeof id !== "string" ||
    !(PUSH_ACTIONS as readonly unknown[]).includes(action)
  ) {
    throw new InvalidActionTokenError("MALFORMED");
  }
  if (exp * 1000 < now.getTime()) throw new InvalidActionTokenError("EXPIRED");
  return { tenantId, userId, tennerId, nextDue, action: action as PushAction, exp, id };
}
