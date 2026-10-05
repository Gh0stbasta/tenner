/** Member options for pickers (HOUSEHOLD-ADMIN-001). */

import type { UserId } from "../../types/domain";
import { fallbackName, useActiveMembers } from "./api";

export interface MemberOption {
  readonly userId: UserId;
  readonly displayName: string;
}

/**
 * Active members, plus `current` if it is not among them (still loading, or a member that is no longer listed),
 * so a select never shows an empty value.
 */
export function useAssignees(current?: UserId): MemberOption[] {
  const members: MemberOption[] = useActiveMembers();
  if (current === undefined || current === "" || members.some((member) => member.userId === current)) return members;
  return [...members, { userId: current, displayName: fallbackName(current) }];
}
