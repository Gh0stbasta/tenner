/** Household settings (SCHEDULING-008): the timezone all due dates are computed in. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { todayIsoDate } from "../../utils/dates";

const householdSchema = z.object({ timezone: z.string().min(1) });
export type Household = z.infer<typeof householdSchema>;

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
