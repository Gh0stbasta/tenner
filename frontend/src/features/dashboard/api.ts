/** GET /dashboard (TICKET-016). */

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { usePendingCompletionIds } from "../completions/CompletionProvider";
import { removeFromDashboard } from "../completions/optimistic";
import { categorySchema, userIdSchema } from "../tenners/schemas";

const dashboardTennerSchema = z.object({
  tennerId: z.string(),
  title: z.string(),
  category: categorySchema,
  assignedTo: userIdSchema,
  /** HOUSEHOLD-004: member the Tenner is covered for during a handover. */
  originalAssignee: z.string().nullable().default(null),
  estimatedMinutes: z.number(),
  nextDue: z.string(),
  snoozedUntil: z.string().nullable(),
  overdueDays: z.number().optional(),
  daysUntilDue: z.number().optional(),
});
export type DashboardTenner = z.infer<typeof dashboardTennerSchema>;

/** SCHEDULING-005: paused Tenners, excluded from all other sections. */
const pausedTennerSchema = dashboardTennerSchema.extend({
  pausedUntil: z.string().nullable(),
  pauseReason: z.enum(["PAUSE", "VACATION"]),
});
export type PausedDashboardTenner = z.infer<typeof pausedTennerSchema>;

const groupSummarySchema = z.object({
  count: z.number(),
  estimatedMinutes: z.number(),
  sharedCount: z.number().optional(),
});
export type GroupSummary = z.infer<typeof groupSummarySchema>;

export const dashboardSchema = z.object({
  referenceDate: z.string(),
  timezone: z.string(),
  summary: z.object({
    dueTodayCount: z.number(),
    overdueCount: z.number(),
    upcomingCount: z.number(),
    dueTodayMinutes: z.number(),
    overdueMinutes: z.number(),
    upcomingMinutes: z.number(),
    totalActionableCount: z.number(),
    totalActionableMinutes: z.number(),
  }),
  dueToday: z.array(dashboardTennerSchema),
  overdue: z.array(dashboardTennerSchema),
  upcoming: z.array(dashboardTennerSchema),
  paused: z.array(pausedTennerSchema).default([]),
  byUser: z.partialRecord(z.string(), groupSummarySchema),
  byCategory: z.partialRecord(z.string(), groupSummarySchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export function fetchDashboard(): Promise<Dashboard> {
  return apiClient.get("/dashboard", { schema: dashboardSchema });
}

/**
 * The dashboard response is the single source of truth for the page (FRONTEND-002); Tenners completed offline and
 * not yet synced stay hidden, also after a refetch (MOBILE-004).
 */
export function useDashboard() {
  const pendingIds = usePendingCompletionIds();
  const select = useCallback((dashboard: Dashboard) => pendingIds.reduce(removeFromDashboard, dashboard), [pendingIds]);
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: fetchDashboard, select });
}
