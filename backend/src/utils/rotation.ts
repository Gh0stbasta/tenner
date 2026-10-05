/** Rotating assignment (HOUSEHOLD-001). */

import type { UserId } from "../models/index.js";

/**
 * The next assignee after `current` in `rotation`, skipping members that are not active (HOUSEHOLD-ADMIN-004).
 * Based on the assigned member, not on who completed, so covering for someone keeps the order. If `current` is not
 * in the rotation, the first active member is next; if nobody else is active, `current` stays.
 */
export function nextInRotation(rotation: readonly UserId[], current: UserId, isActive: (userId: UserId) => boolean): UserId {
  const start = rotation.indexOf(current);
  for (let step = 1; step <= rotation.length; step += 1) {
    const candidate = rotation[(start + step) % rotation.length] as UserId;
    if (candidate !== current && isActive(candidate)) return candidate;
  }
  return current;
}
