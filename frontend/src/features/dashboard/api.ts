/** GET /dashboard (TICKET-016). */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { categorySchema, userIdSchema } from "../tenners/schemas";

const dashboardTennerSchema = z.object({
  tennerId: z.string(),
  title: z.string(),
  category: categorySchema,
  assignedTo: userIdSchema,
  estimatedMinutes: z.number(),
  nextDue: z.string(),
  overdueDays: z.number().optional(),
  daysUntilDue: z.number().optional(),
});
export type DashboardTenner = z.infer<typeof dashboardTennerSchema>;

const groupSummarySchema = z.object({ count: z.number(), estimatedMinutes: z.number() });
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
  byUser: z.partialRecord(userIdSchema, groupSummarySchema),
  byCategory: z.partialRecord(categorySchema, groupSummarySchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

export function fetchDashboard(): Promise<Dashboard> {
  return apiClient.get("/dashboard", { schema: dashboardSchema });
}

/** The dashboard response is the single source of truth for the page (FRONTEND-002). */
export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: fetchDashboard });
}
