/** Read-only completion history (TICKET-020). */

import type { HistoryItemResponse, HistoryRequest, HistoryResponse, TennerHistoryRequest } from "../dto/index.js";
import { NotFoundError } from "../exceptions/index.js";
import type { CompletionRepository, HistoryPage, HistoryQuery, TennerRepository } from "../repositories/index.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";

export const DEFAULT_HISTORY_LIMIT = 20;

export class HistoryService {
  constructor(
    private readonly completions: Pick<CompletionRepository, "getHistory" | "getByTenner">,
    private readonly tenners: Pick<TennerRepository, "getById" | "getTitles">,
  ) {}

  /** Household history, newest first. from/to are inclusive UTC days. */
  async getHistory(tenantId: string, request: HistoryRequest = {}): Promise<HistoryResponse> {
    const page = await this.completions.getHistory(tenantId, {
      ...this.pageQuery(tenantId, request),
      from: request.from === undefined ? undefined : `${request.from}T00:00:00Z`,
      to: request.to === undefined ? undefined : `${request.to}T23:59:59Z`,
      completedBy: request.completedBy,
    });
    return this.toResponse(tenantId, page);
  }

  /** History of one Tenner (also for soft-deleted Tenners). 404 if the Tenner never existed. */
  async getTennerHistory(tenantId: string, tennerId: string, request: TennerHistoryRequest = {}): Promise<HistoryResponse> {
    if (!(await this.tenners.getById(tenantId, tennerId))) throw new NotFoundError("Tenner not found.");
    return this.toResponse(tenantId, await this.completions.getByTenner(tenantId, tennerId, this.pageQuery(tenantId, request)));
  }

  private pageQuery(tenantId: string, request: TennerHistoryRequest): HistoryQuery {
    return {
      limit: request.limit ?? DEFAULT_HISTORY_LIMIT,
      includeReverted: request.includeUndone ?? false,
      startKey: request.cursor === undefined ? undefined : decodeCursor(request.cursor, tenantId),
    };
  }

  private async toResponse(tenantId: string, page: HistoryPage): Promise<HistoryResponse> {
    const titles = page.items.length ? await this.tenners.getTitles(tenantId, page.items.map((c) => c.tennerId)) : new Map<string, string>();
    const items: HistoryItemResponse[] = page.items.map((c) => ({
      completionId: c.completionId,
      tennerId: c.tennerId,
      tennerTitle: titles.get(c.tennerId) ?? null,
      completedBy: c.completedBy,
      completedAt: c.completedAt,
      actualMinutes: c.actualMinutes,
      revertedAt: c.revertedAt,
    }));
    return { items, nextCursor: page.lastKey ? encodeCursor(tenantId, page.lastKey) : null };
  }
}
