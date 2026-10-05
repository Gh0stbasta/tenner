/**
 * Defaults for Quick Add and the create dialog: category, minutes and frequency from the household settings
 * (HOUSEHOLD-ADMIN-003), the assignee from this device's personal preference (FRONTEND-008).
 */

import type { Category, UserId } from "../../types/domain";
import { useSelectableCategories } from "../categories/api";
import { useCurrentUser } from "../completions/CurrentUserProvider";
import { useHouseholdTennerDefaults } from "../household/api";
import { resolveAssignee } from "./preferences";
import { useSettings } from "./SettingsProvider";

export interface NewTennerDefaults {
  readonly category: Category;
  readonly assignedTo: UserId;
  readonly estimatedMinutes: number;
  readonly frequencyDays: number;
}

export function useNewTennerDefaults(): NewTennerDefaults {
  const { preferences } = useSettings();
  const currentUser = useCurrentUser();
  const household = useHouseholdTennerDefaults();
  const selectable = useSelectableCategories();
  // An archived or deleted default category falls back to the first selectable one (HOUSEHOLD-ADMIN-002).
  const preferred = household.category;
  const category =
    selectable.length === 0 || selectable.some((c) => c.categoryId === preferred)
      ? preferred
      : (selectable[0]?.categoryId ?? preferred);
  return {
    category,
    assignedTo: resolveAssignee(preferences.defaultAssignedTo, currentUser),
    estimatedMinutes: household.estimatedMinutes,
    frequencyDays: household.frequencyDays,
  };
}
