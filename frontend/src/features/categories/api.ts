/** Household categories (HOUSEHOLD-ADMIN-002): GET/POST /categories, PUT /categories/{categoryId}. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import { CATEGORY_ICONS, MEMBER_COLORS, type Category, type CategoryIcon, type MemberColor } from "../../types/domain";
import { fallbackName } from "../members/api";

export const categoryEntrySchema = z.object({
  categoryId: z.string(),
  name: z.string(),
  icon: z.enum(CATEGORY_ICONS),
  color: z.enum(MEMBER_COLORS),
  sortOrder: z.number(),
  archived: z.boolean(),
});
export type CategoryEntry = z.infer<typeof categoryEntrySchema>;

const categoryListSchema = z.array(categoryEntrySchema);

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () =>
      (await apiClient.get("/categories", { schema: categoryListSchema })).sort((a, b) => a.sortOrder - b.sortOrder),
    staleTime: 5 * 60_000,
  });
}

/** Categories that can be chosen for new Tenners and filters (not archived), in display order. */
export function useSelectableCategories(): CategoryEntry[] {
  return (useCategories().data ?? []).filter((category) => !category.archived);
}

/** Display name lookup with a readable fallback derived from the ID ("PETS" → "Pets"). */
export function useCategoryName(): (categoryId: Category) => string {
  const categories = useCategories().data;
  return useCallback(
    (categoryId: Category) =>
      categories?.find((category) => category.categoryId === categoryId)?.name ?? fallbackName(categoryId),
    [categories],
  );
}

export interface NewCategory {
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: MemberColor;
}

export interface CategoryChanges {
  readonly name?: string;
  readonly icon?: CategoryIcon;
  readonly color?: MemberColor;
  readonly sortOrder?: number;
  readonly archived?: boolean;
}

function useCategoryMutation<TInput>(mutationFn: (input: TInput) => Promise<CategoryEntry>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useCreateCategory() {
  return useCategoryMutation((category: NewCategory) =>
    apiClient.post("/categories", { schema: categoryEntrySchema, body: category }),
  );
}

export function useUpdateCategory() {
  return useCategoryMutation(
    ({ categoryId, changes }: { readonly categoryId: Category; readonly changes: CategoryChanges }) =>
      apiClient.put(`/categories/${encodeURIComponent(categoryId)}`, { schema: categoryEntrySchema, body: changes }),
  );
}
