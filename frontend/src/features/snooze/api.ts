/** Snooze API (SCHEDULING-003). */

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
