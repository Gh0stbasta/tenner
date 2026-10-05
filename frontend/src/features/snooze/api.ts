/** Snooze and skip API (SCHEDULING-003, SCHEDULING-004). */

import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { trackEvent } from "../../utils/telemetry";
import { useInvalidateTenners } from "../tenners/api";
import { tennerSchema, userIdSchema } from "../tenners/schemas";
import type { SnoozeRequest } from "./snoozeOptions";

export const snoozeResponseSchema = z.object({
  tenner: tennerSchema,
  snooze: z.object({
    snoozeId: z.string(),
    snoozedBy: userIdSchema,
    snoozedAt: z.string(),
    previousNextDue: z.string(),
    snoozedUntil: z.string(),
  }),
});
export type SnoozeResponse = z.infer<typeof snoozeResponseSchema>;

export function snoozeTenner(tennerId: string, request: SnoozeRequest): Promise<SnoozeResponse> {
  return apiClient.post(`/tenners/${encodeURIComponent(tennerId)}/snooze`, {
    schema: snoozeResponseSchema,
    body: request,
  });
}

export function useSnoozeTenner() {
  const invalidate = useInvalidateTenners();
  return useMutation({
    mutationFn: ({ tennerId, request }: { readonly tennerId: string; readonly request: SnoozeRequest }) =>
      snoozeTenner(tennerId, request),
    onSuccess: (response) =>
      trackEvent("TennerSnoozed", { tennerId: response.tenner.tennerId, snoozedUntil: response.snooze.snoozedUntil }),
    onSettled: invalidate,
  });
}

/** Skip one occurrence (SCHEDULING-004). */
export const skipResponseSchema = z.object({
  tenner: tennerSchema,
  skip: z.object({
    skipId: z.string(),
    skippedBy: userIdSchema,
    skippedAt: z.string(),
    skippedDue: z.string(),
    nextDue: z.string(),
    reason: z.string().nullable(),
  }),
});
export type SkipResponse = z.infer<typeof skipResponseSchema>;

export function skipTenner(tennerId: string, reason: string): Promise<SkipResponse> {
  const trimmed = reason.trim();
  return apiClient.post(`/tenners/${encodeURIComponent(tennerId)}/skip`, {
    schema: skipResponseSchema,
    body: trimmed === "" ? {} : { reason: trimmed },
  });
}

export function useSkipTenner() {
  const invalidate = useInvalidateTenners();
  return useMutation({
    mutationFn: ({ tennerId, reason }: { readonly tennerId: string; readonly reason: string }) =>
      skipTenner(tennerId, reason),
    onSuccess: (response) =>
      trackEvent("TennerSkipped", { tennerId: response.tenner.tennerId, nextDue: response.skip.nextDue }),
    onSettled: invalidate,
  });
}
