import type { CompleteTennerRequest, CompletionResponse, CreateTennerRequest, TennerResponse, UpdateTennerRequest } from "../dto/index.js";

export interface CompleteTennerResult {
  readonly tenner: TennerResponse;
  readonly completion: CompletionResponse;
}

/**
 * Business operations on Tenners. Implementations depend on repository interfaces only
 * and throw ApplicationError subclasses for expected failures.
 */
export interface TennerService {
  createTenner(tenantId: string, request: CreateTennerRequest): Promise<TennerResponse>;
  updateTenner(tenantId: string, tennerId: string, request: UpdateTennerRequest): Promise<TennerResponse>;
  completeTenner(tenantId: string, tennerId: string, request: CompleteTennerRequest): Promise<CompleteTennerResult>;
  /** Active Tenners due on or before the given calendar date (YYYY-MM-DD). */
  listDueTenners(tenantId: string, date: string): Promise<TennerResponse[]>;
}
