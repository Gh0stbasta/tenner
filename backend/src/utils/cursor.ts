/**
 * Opaque pagination cursors: base64url(JSON { t: tenantId, k: lastKey }).
 * The tenant is embedded and verified on decode, so a cursor cannot switch tenants.
 */

import { ValidationError } from "../exceptions/index.js";
import type { HistoryKey } from "../repositories/index.js";

export function encodeCursor(tenantId: string, key: HistoryKey): string {
  return Buffer.from(JSON.stringify({ t: tenantId, k: key }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string, tenantId: string): HistoryKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }
  const { t, k } = (parsed ?? {}) as { t?: unknown; k?: unknown };
  if (t !== tenantId || typeof k !== "object" || k === null || Array.isArray(k)) throw invalid();
  const entries = Object.entries(k);
  if (!entries.length || !entries.every(([, value]) => typeof value === "string")) throw invalid();
  if ((k as Record<string, unknown>).tenantId !== tenantId) throw invalid();
  return k as HistoryKey;
}

function invalid(): ValidationError {
  return new ValidationError("Invalid cursor.", [{ field: "cursor", message: "Invalid cursor." }]);
}
