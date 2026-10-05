/** Defaults for Quick Add and the create dialog from the user preferences (FRONTEND-008). */

import type { Category, UserId } from "../../types/domain";
import { useSelectableCategories } from "../categories/api";
import { useCurrentUser } from "../completions/CurrentUserProvider";
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
  const selectable = useSelectableCategories();
  // An archived or deleted default category falls back to the first selectable one (HOUSEHOLD-ADMIN-002).
  const preferred = preferences.defaultCategory;
  const category =
    selectable.length === 0 || selectable.some((c) => c.categoryId === preferred)
      ? preferred
      : (selectable[0]?.categoryId ?? preferred);
  return {
    category,
    assignedTo: resolveAssignee(preferences.defaultAssignedTo, currentUser),
    estimatedMinutes: preferences.defaultEstimatedMinutes,
    frequencyDays: preferences.defaultFrequencyDays,
  };
}
