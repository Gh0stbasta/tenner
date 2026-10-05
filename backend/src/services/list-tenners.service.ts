/** Business logic for listing Tenners (TICKET-010). */

import { toTennerResponse, type ListTennersRequest, type ListTennersResponse, type SortOrder, type TennerSortField } from "../dto/index.js";
import type { Tenner } from "../models/index.js";
import type { TennerCriteria, TennerRepository } from "../repositories/index.js";
import type { Clock } from "../utils/clock.js";
import { dateInTimeZone, type TimeZoneSource } from "../utils/timezone.js";

export const DEFAULT_SORT: TennerSortField = "nextDue";
export const DEFAULT_ORDER: SortOrder = "asc";

export class ListTennersService {
  constructor(
    private readonly repository: Pick<TennerRepository, "list">,
    private readonly clock: Clock,
    private readonly timezoneOf: TimeZoneSource,
  ) {}

  async listTenners(tenantId: string, request: ListTennersRequest = {}): Promise<ListTennersResponse> {
    const needsToday = request.due === true || request.overdue === true;
    const today = needsToday ? dateInTimeZone(this.clock(), await this.timezoneOf(tenantId)) : "";
    const criteria = toCriteria(request, today);
    const tenners = await this.repository.list(tenantId, criteria);
    return sortTenners(tenners, request.sort ?? DEFAULT_SORT, request.order ?? DEFAULT_ORDER).map(toTennerResponse);
  }
}

/**
 * Apply defaults and translate due/overdue into date bounds; `today` is the household-local date (SCHEDULING-008).
 * Archived (deleted=true) Tenners are inactive, so the active default does not apply to them.
 */
export function toCriteria(request: ListTennersRequest, today: string): TennerCriteria {
  return {
    assignedTo: request.assignedTo,
    category: request.category,
    active: request.deleted ? request.active : (request.active ?? true),
    ...(request.deleted ? { onlyDeleted: true } : {}),
    // overdue (nextDue < today) is stricter than due (nextDue <= today).
    nextDueBefore: request.overdue ? today : undefined,
    nextDueOnOrBefore: request.due && !request.overdue ? today : undefined,
  };
}

/** Stable sort by field and order; ties by title, then tennerId. */
export function sortTenners(tenners: readonly Tenner[], field: TennerSortField, order: SortOrder): Tenner[] {
  const direction = order === "asc" ? 1 : -1;
  const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return [...tenners].sort(
    (a, b) => direction * compare(a[field], b[field]) || compare(a.title, b.title) || compare(a.tennerId, b.tennerId),
  );
}
