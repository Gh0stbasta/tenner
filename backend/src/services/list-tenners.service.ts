/** Business logic for listing Tenners (TICKET-010). */

import { toTennerResponse, type ListTennersRequest, type ListTennersResponse, type SortOrder, type TennerSortField } from "../dto/index.js";
import type { Tenner } from "../models/index.js";
import type { TennerCriteria, TennerRepository } from "../repositories/index.js";
import { toUtcDate, type Clock } from "../utils/clock.js";

export const DEFAULT_SORT: TennerSortField = "nextDue";
export const DEFAULT_ORDER: SortOrder = "asc";

export class ListTennersService {
  constructor(
    private readonly repository: Pick<TennerRepository, "list">,
    private readonly clock: Clock,
  ) {}

  async listTenners(tenantId: string, request: ListTennersRequest = {}): Promise<ListTennersResponse> {
    const criteria = this.toCriteria(request);
    const tenners = await this.repository.list(tenantId, criteria);
    return sortTenners(tenners, request.sort ?? DEFAULT_SORT, request.order ?? DEFAULT_ORDER).map(toTennerResponse);
  }

  /**
   * Apply defaults and translate due/overdue into date bounds (UTC today).
   * Archived (deleted=true) Tenners are inactive, so the active default does not apply to them.
   */
  toCriteria(request: ListTennersRequest): TennerCriteria {
    const today = toUtcDate(this.clock());
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
}

/** Stable sort by field and order; ties by title, then tennerId. */
export function sortTenners(tenners: readonly Tenner[], field: TennerSortField, order: SortOrder): Tenner[] {
  const direction = order === "asc" ? 1 : -1;
  const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return [...tenners].sort(
    (a, b) => direction * compare(a[field], b[field]) || compare(a.title, b.title) || compare(a.tennerId, b.tennerId),
  );
}
