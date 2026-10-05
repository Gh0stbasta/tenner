/** Household settings: the timezone all due dates are computed in (SCHEDULING-008) and the vacation (SCHEDULING-005). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { WEEKDAYS, type Category, type Weekday } from "../../types/domain";
import { todayIsoDate } from "../../utils/dates";
import { trackEvent } from "../../utils/telemetry";
import { categorySchema } from "../tenners/schemas";

const vacationSchema = z.object({
  from: z.string(),
  until: z.string(),
  categories: z.array(categorySchema).nullable(),
});
export type Vacation = z.infer<typeof vacationSchema>;

/** Temporary handover of one member's Tenners (HOUSEHOLD-004); `until` is the last day. */
const handoverSchema = z.object({
  from: z.string(),
  to: z.string(),
  until: z.string(),
  categories: z.array(categorySchema).nullable(),
});
export type Handover = z.infer<typeof handoverSchema>;

export const WEEK_STARTS = ["MONDAY", "SUNDAY"] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];

/** Built-in defaults, also used while the household settings load (mirror the backend defaults). */
export const BUILT_IN_TENNER_DEFAULTS = { category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14 } as const;

const tennerDefaultsSchema = z.object({
  category: z.string(),
  estimatedMinutes: z.number(),
  frequencyDays: z.number(),
});
export type HouseholdTennerDefaults = z.infer<typeof tennerDefaultsSchema>;

/** Household-wide settings (SCHEDULING-008, SCHEDULING-005, HOUSEHOLD-ADMIN-003); missing fields get the defaults. */
const householdSchema = z.object({
  name: z.string().default("Unser Haushalt"),
  timezone: z.string().min(1),
  weekStartsOn: z.enum(WEEK_STARTS).default("MONDAY"),
  workdays: z.array(z.enum(WEEKDAYS)).default(["MON", "TUE", "WED", "THU", "FRI"]),
  defaults: tennerDefaultsSchema.default(BUILT_IN_TENNER_DEFAULTS),
  defaultsSource: z.enum(["DEFAULT", "HOUSEHOLD"]).default("DEFAULT"),
  vacation: vacationSchema.nullable().default(null),
  handovers: z.array(handoverSchema).default([]),
});
export type Household = z.infer<typeof householdSchema>;

export interface HouseholdChanges {
  readonly name?: string;
  readonly timezone?: string;
  readonly weekStartsOn?: WeekStart;
  readonly workdays?: readonly Weekday[];
  readonly defaults?: HouseholdTennerDefaults;
}

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

/** Household settings are shared; a new timezone changes "today", so date-dependent data is reloaded too. */
export function useUpdateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: HouseholdChanges) => apiClient.put("/household", { schema: householdSchema, body: changes }),
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

/** Household defaults for new Tenners (built-in values while loading). */
export function useHouseholdTennerDefaults(): HouseholdTennerDefaults {
  return useHousehold().data?.defaults ?? BUILT_IN_TENNER_DEFAULTS;
}

/** Running handovers (HOUSEHOLD-004); expired ones are given back by the server on the next read. */
export function useHandovers(): readonly Handover[] {
  return useHousehold().data?.handovers ?? [];
}

export interface HandoverInput {
  readonly from: string;
  readonly to: string;
  readonly until: string;
  /** Omitted = all categories. */
  readonly categories?: readonly Category[];
}

const startHandoverSchema = z.object({ handover: handoverSchema, handedOver: z.number() });
const endHandoverSchema = z.object({ returned: z.number() });

/** A handover reassigns Tenners, so household, dashboard and lists are reloaded. */
function useHandoverMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.household });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenners });
    },
  });
}

export function useStartHandover() {
  return useHandoverMutation(async ({ from, ...body }: HandoverInput) => {
    const result = await apiClient.post(`/users/${encodeURIComponent(from)}/handover`, {
      schema: startHandoverSchema,
      body,
    });
    trackEvent("HandoverStarted", { until: body.until, handedOver: result.handedOver });
    return result;
  });
}

export function useEndHandover() {
  return useHandoverMutation(async (from: string) => {
    const result = await apiClient.delete(`/users/${encodeURIComponent(from)}/handover`, { schema: endHandoverSchema });
    trackEvent("HandoverEnded", { returned: result.returned });
    return result;
  });
}
