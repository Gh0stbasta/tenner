/** Detail data: GET /tenners/{id} (TICKET-019) and GET /tenners/{id}/history (TICKET-020). */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { historyPageSchema, type HistoryPage } from "../completions/api";
import { tennerSchema, type Tenner } from "../tenners/schemas";

export const HISTORY_PAGE_SIZE = 20;

/** Includes archived Tenners, so links from the archive view work. */
export function fetchTenner(tennerId: string): Promise<Tenner> {
  return apiClient.get(`/tenners/${encodeURIComponent(tennerId)}`, {
    schema: tennerSchema,
    query: { includeDeleted: true },
  });
}

export function fetchTennerHistory(tennerId: string, cursor: string | undefined): Promise<HistoryPage> {
  return apiClient.get(`/tenners/${encodeURIComponent(tennerId)}/history`, {
    schema: historyPageSchema,
    query: { limit: HISTORY_PAGE_SIZE, cursor },
  });
}

export function useTenner(tennerId: string) {
  return useQuery({ queryKey: queryKeys.tenner(tennerId), queryFn: () => fetchTenner(tennerId) });
}

/** Completions newest first, loaded page by page ("Mehr anzeigen"). */
export function useTennerHistory(tennerId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.tennerHistory(tennerId),
    queryFn: ({ pageParam }) => fetchTennerHistory(tennerId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
