/** Maps DynamoDB items to Tenner domain objects (explicit fields only; storage metadata is dropped). */

import type { Category, Tenner, UserId } from "../../models/index.js";

export type TennerItem = Record<string, unknown>;

export function toTenner(item: TennerItem): Tenner {
  return {
    tenantId: String(item.tenantId),
    tennerId: String(item.tennerId),
    title: String(item.title),
    category: item.category as Category,
    estimatedMinutes: Number(item.estimatedMinutes),
    frequencyDays: Number(item.frequencyDays),
    assignedTo: item.assignedTo as UserId,
    lastCompleted: typeof item.lastCompleted === "string" ? item.lastCompleted : null,
    nextDue: String(item.nextDue),
    active: item.active === true,
    deletedAt: typeof item.deletedAt === "string" ? item.deletedAt : null,
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
  };
}
