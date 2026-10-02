/** Tenner API calls and hooks (TICKET-009 – TICKET-015, TICKET-024). */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import type { Category, UserId } from "../../types/domain";
import { trackEvent } from "../../utils/telemetry";
import { useCurrentUser } from "../completions/useCurrentUser";
import { tennerSchema, type Tenner } from "./schemas";

export const SORT_FIELDS = ["nextDue", "title", "createdAt", "updatedAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";
export type StatusFilter = "active" | "archived" | "all";

export interface TennerListParams {
  readonly status: StatusFilter;
  readonly assignedTo?: UserId | undefined;
  readonly category?: Category | undefined;
  readonly sort: SortField;
  readonly order: SortOrder;
}

export const DEFAULT_LIST_PARAMS: TennerListParams = { status: "active", sort: "nextDue", order: "asc" };

const tennerListSchema = z.array(tennerSchema);

function fetchList(query: Record<string, string | boolean | undefined>): Promise<Tenner[]> {
  return apiClient.get("/tenners", { schema: tennerListSchema, query });
}

/** "all" combines active, inactive and archived Tenners (three backend queries). */
export async function listTenners({ status, assignedTo, category, sort, order }: TennerListParams): Promise<Tenner[]> {
  const base = { assignedTo, category, sort, order };
  if (status === "active") return fetchList(base);
  if (status === "archived") return fetchList({ ...base, deleted: true });
  const [active, inactive, archived] = await Promise.all([
    fetchList(base),
    fetchList({ ...base, active: false }),
    fetchList({ ...base, deleted: true }),
  ]);
  return sortTenners([...active, ...inactive, ...archived], sort, order);
}

/** Same ordering as the backend: field, then title, then ID. */
export function sortTenners(tenners: readonly Tenner[], field: SortField, order: SortOrder): Tenner[] {
  const direction = order === "asc" ? 1 : -1;
  const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return [...tenners].sort(
    (a, b) => direction * compare(a[field], b[field]) || compare(a.title, b.title) || compare(a.tennerId, b.tennerId),
  );
}

export function useTenners(params: TennerListParams) {
  return useQuery({
    queryKey: queryKeys.tennerList(params),
    queryFn: () => listTenners(params),
    placeholderData: keepPreviousData,
  });
}

const deleteResponseSchema = z.object({ tennerId: z.string(), deleted: z.literal(true) });
const restoreResponseSchema = z.object({ tennerId: z.string(), active: z.boolean(), deletedAt: z.string().nullable() });

export function archiveTenner(tennerId: string) {
  return apiClient.delete(`/tenners/${encodeURIComponent(tennerId)}`, { schema: deleteResponseSchema });
}

export function restoreTenner(tennerId: string, restoredBy: UserId) {
  return apiClient.post(`/tenners/${encodeURIComponent(tennerId)}/restore`, {
    schema: restoreResponseSchema,
    body: { restoredBy },
  });
}

/** Invalidate everything that shows Tenners. */
export function useInvalidateTenners() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tenners }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
}

export function useArchiveTenner() {
  const invalidate = useInvalidateTenners();
  return useMutation({
    mutationFn: (tenner: Tenner) => archiveTenner(tenner.tennerId),
    onSuccess: (_, tenner) => trackEvent("TennerArchived", { tennerId: tenner.tennerId }),
    onSettled: invalidate,
  });
}

export function useRestoreTenner() {
  const invalidate = useInvalidateTenners();
  const restoredBy = useCurrentUser();
  return useMutation({
    mutationFn: (tenner: Tenner) => restoreTenner(tenner.tennerId, restoredBy),
    onSuccess: (_, tenner) => trackEvent("TennerRestored", { tennerId: tenner.tennerId }),
    onSettled: invalidate,
  });
}

export interface TennerInput {
  readonly title: string;
  readonly category: Category;
  readonly assignedTo: UserId;
  readonly estimatedMinutes: number;
  readonly frequencyDays: number;
}

export function createTenner(input: TennerInput): Promise<Tenner> {
  return apiClient.post("/tenners", { schema: tennerSchema, body: input });
}

export function useCreateTenner() {
  const invalidate = useInvalidateTenners();
  return useMutation({
    mutationFn: createTenner,
    onSuccess: (created) => trackEvent("TennerCreated", { tennerId: created.tennerId }),
    onSettled: invalidate,
  });
}
