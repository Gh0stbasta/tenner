/** Maps DynamoDB items to Tenner domain objects (explicit fields only; storage metadata is dropped). */

import { FREQUENCY_UNITS, type Category, type FrequencyUnit, type Tenner, type UserId } from "../../models/index.js";

export type TennerItem = Record<string, unknown>;

const userIdOrNull = (value: unknown): UserId | null => (typeof value === "string" ? (value as UserId) : null);

/** Items stored before SCHEDULING-001 have no unit: read them as DAY with interval = frequencyDays. */
function frequencyUnitOf(value: unknown): FrequencyUnit {
  return (FREQUENCY_UNITS as readonly unknown[]).includes(value) ? (value as FrequencyUnit) : "DAY";
}

export function toTenner(item: TennerItem): Tenner {
  const frequencyDays = Number(item.frequencyDays);
  const frequencyUnit = frequencyUnitOf(item.frequencyUnit);
  return {
    tenantId: String(item.tenantId),
    tennerId: String(item.tennerId),
    title: String(item.title),
    category: item.category as Category,
    estimatedMinutes: Number(item.estimatedMinutes),
    frequencyDays,
    frequencyUnit,
    frequencyInterval: item.frequencyUnit === frequencyUnit && typeof item.frequencyInterval === "number" ? item.frequencyInterval : frequencyDays,
    assignedTo: item.assignedTo as UserId,
    lastCompleted: typeof item.lastCompleted === "string" ? item.lastCompleted : null,
    nextDue: String(item.nextDue),
    snoozedUntil: typeof item.snoozedUntil === "string" ? item.snoozedUntil : null,
    active: item.active === true,
    deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : null,
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
    createdBy: userIdOrNull(item.createdBy),
    updatedBy: userIdOrNull(item.updatedBy),
  };
}
