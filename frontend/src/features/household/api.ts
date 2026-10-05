/** Household settings: the timezone all due dates are computed in (SCHEDULING-008) and the vacation (SCHEDULING-005). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import type { Category } from "../../types/domain";
import { todayIsoDate } from "../../utils/dates";
import { trackEvent } from "../../utils/telemetry";
import { categorySchema } from "../tenners/schemas";

const vacationSchema = z.object({
  from: z.string(),
  until: z.string(),
  categories: z.array(categorySchema).nullable(),
});
export type Vacation = z.infer<typeof vacationSchema>;

const householdSchema = z.object({ timezone: z.string().min(1), vacation: vacationSchema.nullable().default(null) });
export type Household = z.infer<typeof householdSchema>;

const vacationUpdateSchema = z.object({ household: householdSchema, rescheduled: z.number(), conflicts: z.number() });
export type VacationUpdate = z.infer<typeof vacationUpdateSchema>;

export interface VacationInput {
  readonly from: string;
  readonly until: string;
  /** Omitted = all categories. */
  readonly categories?: readonly Category[];
}

export function useHousehold() {
  return useQuery({
    queryKey: queryKeys.household,
    queryFn: () => apiClient.get("/household", { schema: householdSchema }),
    staleTime: 5 * 60_000,
  });
}

/** Saving a new timezone changes "today" for every list, so all date-dependent data is reloaded. */
export function useUpdateHouseholdTimezone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (timezone: string) => apiClient.put("/household", { schema: householdSchema, body: { timezone } }),
    onSuccess: (household) => {
      queryClient.setQueryData(queryKeys.household, household);
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenners });
    },
  });
}

/** The household timezone, or undefined while loading or unavailable (callers then use the browser's zone). */
export function useHouseholdTimezone(): string | undefined {
  return useHousehold().data?.timezone;
}

/** Today as YYYY-MM-DD in the household timezone (fallback: browser timezone). */
export function useToday(): string {
  return todayIsoDate(new Date(), useHouseholdTimezone());
}

/** IANA timezones known to the browser (all modern browsers support Intl.supportedValuesOf). */
export function availableTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Europe/Berlin", "UTC"];
  }
}

/** The household vacation, or null (also while loading). */
export function useHouseholdVacation(): Vacation | null {
  return useHousehold().data?.vacation ?? null;
}

/** Setting or ending a vacation moves due dates, so dashboard and lists are reloaded. */
function useVacationMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  household: (result: TResult) => Household,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.household, household(result));
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenners });
    },
  });
}

export function useSetVacation() {
  return useVacationMutation(
    async (input: VacationInput) => {
      const result = await apiClient.put("/household/vacation", { schema: vacationUpdateSchema, body: input });
      trackEvent("VacationSet", { from: input.from, until: input.until, rescheduled: result.rescheduled });
      return result;
    },
    (result) => result.household,
  );
}

export function useEndVacation() {
  return useVacationMutation(
    async () => {
      const result = await apiClient.delete("/household/vacation", { schema: householdSchema });
      trackEvent("VacationEnded");
      return result;
    },
    (result) => result,
  );
}
