/** Deterministic UUID v5 (RFC 9562, SHA-1 name-based), used for idempotent completion IDs. */

import { createHash } from "node:crypto";

/** Fixed namespace for Tenner idempotency keys (random UUID, never change). */
export const IDEMPOTENCY_NAMESPACE = "6f1c2a8e-3b7d-4e59-9a0c-1d2e3f405162";

export function uuidV5(name: string, namespace: string = IDEMPOTENCY_NAMESPACE): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(namespaceBytes).update(name, "utf8").digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50; // version 5
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** SHA-256 hex digest of a JSON-serializable value (stable for objects built with a fixed key order). */
export function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
