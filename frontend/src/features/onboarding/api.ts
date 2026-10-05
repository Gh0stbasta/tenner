/** Household self-assignment API (HOTFIX-001): which members are free, and claim one. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { USER_IDS, type UserId } from "../../types/domain";

const userIdSchema = z.enum(USER_IDS);

export const onboardingSchema = z.object({
  assignedTo: userIdSchema.nullable(),
  members: z.array(z.object({ userId: userIdSchema, displayName: z.string(), available: z.boolean() })),
});

export type Onboarding = z.infer<typeof onboardingSchema>;
export type HouseholdMemberOption = Onboarding["members"][number];

const assignmentSchema = z.object({ userId: userIdSchema });

export function useOnboarding() {
  return useQuery({
    queryKey: queryKeys.onboarding,
    queryFn: () => apiClient.get("/onboarding", { schema: onboardingSchema }),
  });
}

/** Assignment hook: claims a member; the free/taken list is reloaded either way. */
export function useAssignHouseholdMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: UserId) =>
      apiClient.post("/onboarding/assignment", { schema: assignmentSchema, body: { userId } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.onboarding }),
  });
}
