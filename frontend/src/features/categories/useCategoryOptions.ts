/** Category options for pickers (HOUSEHOLD-ADMIN-002). */

import type { Category, CategoryIcon } from "../../types/domain";
import { fallbackName } from "../members/api";
import { useCategories, useSelectableCategories } from "./api";

export interface CategoryOption {
  readonly categoryId: Category;
  readonly name: string;
  readonly icon?: CategoryIcon;
  /** True for the current value of an existing Tenner whose category is archived (kept, not selectable anew). */
  readonly archived?: boolean;
}

/** Selectable categories, plus `current` if it is not among them (archived or still loading). */
export function useCategoryOptions(current?: Category): CategoryOption[] {
  const loaded = useCategories().isSuccess;
  const categories: CategoryOption[] = useSelectableCategories();
  if (current === undefined || current === "" || categories.some((category) => category.categoryId === current))
    return categories;
  // While loading the value is only unknown, not archived.
  return [...categories, { categoryId: current, name: fallbackName(current), archived: loaded }];
}
