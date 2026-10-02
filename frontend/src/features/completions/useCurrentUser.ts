import { USER_IDS, type UserId } from "../../types/domain";

/** Default user for completions until a user can be selected (FRONTEND-007/008). */
export const DEFAULT_USER: UserId = USER_IDS[0];

export function useCurrentUser(): UserId {
  return DEFAULT_USER;
}
