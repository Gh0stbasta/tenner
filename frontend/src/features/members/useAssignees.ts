/** Member options for pickers (HOUSEHOLD-ADMIN-001, HOUSEHOLD-002). */

import { SHARED_ASSIGNEE, type UserId } from "../../types/domain";
import { fallbackName, useActiveMembers } from "./api";

export interface MemberOption {
  readonly userId: UserId;
  readonly displayName: string;
}

/** The shared assignee as a picker option. */
export const SHARED_OPTION: MemberOption = { userId: SHARED_ASSIGNEE, displayName: "Alle (gemeinsam)" };

/**
 * Active members (plus "Alle (gemeinsam)" with `includeShared`), plus `current` if it is not among them (still
 * loading, or a member that is no longer listed), so a select never shows an empty value.
 */
export function useAssignees(
  current?: UserId,
  { includeShared = false }: { readonly includeShared?: boolean } = {},
): MemberOption[] {
  const members: MemberOption[] = [...useActiveMembers(), ...(includeShared ? [SHARED_OPTION] : [])];
  if (current === undefined || current === "" || members.some((member) => member.userId === current)) return members;
  return [
    ...members,
    current === SHARED_ASSIGNEE ? SHARED_OPTION : { userId: current, displayName: fallbackName(current) },
  ];
}
