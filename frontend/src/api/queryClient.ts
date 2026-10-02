/** TanStack Query client with the application's defaults (FRONTEND-001). */

import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./errors";

export const MAX_QUERY_RETRIES = 3;

/** Retry reads only for transient failures; 4xx responses will not change on retry. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  return !isApiError(error) || error.isTransient;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
      // Writes are not idempotent in general: never retry them automatically.
      mutations: { retry: false },
    },
  });
}
