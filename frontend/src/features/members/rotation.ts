/** Rotating assignment (HOUSEHOLD-001). Mirrors backend/src/utils/rotation.ts. */

import type { UserId } from "../../types/domain";

/** The next assignee after `current`, skipping inactive members; `current` if nobody else is active. */
export function nextInRotation(
  rotation: readonly UserId[],
  current: UserId,
  isActive: (userId: UserId) => boolean,
): UserId {
  const start = rotation.indexOf(current);
  for (let step = 1; step <= rotation.length; step += 1) {
    const candidate = rotation[(start + step) % rotation.length] as UserId;
    if (candidate !== current && isActive(candidate)) return candidate;
  }
  return current;
}
