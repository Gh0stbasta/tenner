/** Pause and resume API (SCHEDULING-005). */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { trackEvent } from "../../utils/telemetry";
import { useInvalidateTenners } from "../tenners/api";
import { tennerSchema, type Tenner } from "../tenners/schemas";

export function pauseTenner(tennerId: string, until: string | null): Promise<Tenner> {
  return apiClient.post(`/tenners/${encodeURIComponent(tennerId)}/pause`, {
    schema: tennerSchema,
    body: until === null ? {} : { until },
  });
}

export function resumeTenner(tennerId: string): Promise<Tenner> {
  return apiClient.post(`/tenners/${encodeURIComponent(tennerId)}/resume`, { schema: tennerSchema, body: {} });
}

export function usePauseTenner() {
  const invalidate = useInvalidateTenners();
  return useMutation({
    mutationFn: ({ tennerId, until }: { readonly tennerId: string; readonly until: string | null }) =>
      pauseTenner(tennerId, until),
    onSuccess: (tenner) => trackEvent("TennerPaused", { tennerId: tenner.tennerId, pausedUntil: tenner.pausedUntil }),
    onSettled: invalidate,
  });
}

export function useResumeTenner() {
  const invalidate = useInvalidateTenners();
  return useMutation({
    mutationFn: (tennerId: string) => resumeTenner(tennerId),
    onSuccess: (tenner) => trackEvent("TennerResumed", { tennerId: tenner.tennerId }),
    onSettled: invalidate,
  });
}
