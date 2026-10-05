/** Defaults for Quick Add and the create dialog from the user preferences (FRONTEND-008). */

import type { Category, UserId } from "../../types/domain";
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
  return {
    category: preferences.defaultCategory,
    assignedTo: resolveAssignee(preferences.defaultAssignedTo, currentUser),
    estimatedMinutes: preferences.defaultEstimatedMinutes,
    frequencyDays: preferences.defaultFrequencyDays,
  };
}
