/** In-memory delivery log with the same claim rules as tenner-notifications (NOTIFICATION-001/004). */
import { vi } from "vitest";
import { MAX_TOTAL_ATTEMPTS, type DeliveryLog, type DeliveryRecord } from "../../src/notifications/index.js";

export function memoryDeliveryLog() {
  const records = new Map<string, DeliveryRecord>();
  const log: DeliveryLog = {
    claim: vi.fn(async (record: DeliveryRecord) => {
      const existing = records.get(record.notificationKey);
      if (existing && !(existing.status === "FAILED" && existing.attempts < MAX_TOTAL_ATTEMPTS)) return false;
      records.set(record.notificationKey, { ...record, attempts: existing?.attempts ?? 0 });
      return true;
    }),
    complete: vi.fn(async (key: string, status: DeliveryRecord["status"], attempts: number, errorCode: string | null) => {
      const existing = records.get(key) as DeliveryRecord;
      records.set(key, { ...existing, status, attempts: existing.attempts + attempts, errorCode });
    }),
    has: vi.fn(async (key: string) => records.has(key)),
    mark: vi.fn(async (record: DeliveryRecord) => {
      records.set(record.notificationKey, record);
    }),
  };
  return { log, records };
}
