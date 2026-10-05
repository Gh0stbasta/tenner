/** Maps DynamoDB items to Tenner domain objects (explicit fields only; storage metadata is dropped). */

import { FREQUENCY_UNITS, USER_ID_PATTERN, WEEKDAYS, type Category, type FrequencyUnit, type Tenner, type UserId, type Weekday } from "../../models/index.js";

export type TennerItem = Record<string, unknown>;

const userIdOrNull = (value: unknown): UserId | null => (typeof value === "string" ? (value as UserId) : null);

/** Items stored before SCHEDULING-001 have no unit: read them as DAY with interval = frequencyDays. */
function frequencyUnitOf(value: unknown): FrequencyUnit {
  return (FREQUENCY_UNITS as readonly unknown[]).includes(value) ? (value as FrequencyUnit) : "DAY";
}

/** Stored weekdays in ISO order; null unless the unit is WEEK and at least one valid weekday is stored (SCHEDULING-002). */
function weekdaysOf(value: unknown, unit: FrequencyUnit): Weekday[] | null {
  if (unit !== "WEEK" || !Array.isArray(value)) return null;
  const weekdays = WEEKDAYS.filter((day) => value.includes(day));
  return weekdays.length > 0 ? weekdays : null;
}

/** Rotation only with mode ROTATING and at least two valid IDs; everything else reads as FIXED (HOUSEHOLD-001). */
function assignmentOf(item: TennerItem): Pick<Tenner, "assignmentMode" | "rotation"> {
  const rotation = Array.isArray(item.rotation) ? item.rotation.filter((id): id is string => typeof id === "string" && USER_ID_PATTERN.test(id)) : [];
  return item.assignmentMode === "ROTATING" && rotation.length >= 2 ? { assignmentMode: "ROTATING", rotation } : { assignmentMode: "FIXED", rotation: null };
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
    weekdays: weekdaysOf(item.weekdays, frequencyUnit),
    assignedTo: item.assignedTo as UserId,
    ...assignmentOf(item),
    originalAssignee: typeof item.originalAssignee === "string" && USER_ID_PATTERN.test(item.originalAssignee) ? item.originalAssignee : null,
    lastCompleted: typeof item.lastCompleted === "string" ? item.lastCompleted : null,
    nextDue: String(item.nextDue),
    snoozedUntil: typeof item.snoozedUntil === "string" ? item.snoozedUntil : null,
    pausedAt: typeof item.pausedAt === "string" ? item.pausedAt : null,
    pausedUntil: typeof item.pausedAt === "string" && typeof item.pausedUntil === "string" ? item.pausedUntil : null,
    active: item.active === true,
    deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : null,
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
    createdBy: userIdOrNull(item.createdBy),
    updatedBy: userIdOrNull(item.updatedBy),
  };
}
