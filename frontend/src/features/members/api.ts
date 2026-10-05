/** Household members (HOUSEHOLD-ADMIN-001): GET/POST /users, PUT /users/{userId}. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { MEMBER_COLORS, type MemberColor, type UserId } from "../../types/domain";

export const memberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  color: z.enum(MEMBER_COLORS),
  active: z.boolean(),
});
export type Member = z.infer<typeof memberSchema>;

const memberListSchema = z.array(memberSchema);

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members,
    queryFn: () => apiClient.get("/users", { schema: memberListSchema }),
    staleTime: 5 * 60_000,
  });
}

/** Active members for pickers (empty while loading). */
export function useActiveMembers(): Member[] {
  return (useMembers().data ?? []).filter((member) => member.active);
}

/** Fallback while members load or for IDs that are no longer listed: "LENA_MARIE" → "Lena Marie". */
export function fallbackName(userId: UserId): string {
  return userId
    .toLowerCase()
    .split("_")
    .filter((part) => part !== "")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Display name lookup: the member's name, or a readable fallback derived from the ID. */
export function useMemberName(): (userId: UserId) => string {
  const members = useMembers().data;
  return useCallback(
    (userId: UserId) => members?.find((member) => member.userId === userId)?.displayName ?? fallbackName(userId),
    [members],
  );
}

export interface NewMember {
  readonly displayName: string;
  readonly color: MemberColor;
}

export interface MemberChanges {
  readonly displayName?: string;
  readonly color?: MemberColor;
}

/** Member changes affect names everywhere (onboarding included), so the member list is reloaded. */
function useMemberMutation<TInput>(mutationFn: (input: TInput) => Promise<Member>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.members })]),
  });
}

export function useCreateMember() {
  return useMemberMutation((member: NewMember) => apiClient.post("/users", { schema: memberSchema, body: member }));
}

export function useUpdateMember() {
  return useMemberMutation(({ userId, changes }: { readonly userId: UserId; readonly changes: MemberChanges }) =>
    apiClient.put(`/users/${encodeURIComponent(userId)}`, { schema: memberSchema, body: changes }),
  );
}
