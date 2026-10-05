/** /categories contracts (HOUSEHOLD-ADMIN-002). */

import type { Category, CategoryIcon, MemberColor } from "../models/index.js";

export interface CategoryResponse {
  readonly categoryId: Category;
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: MemberColor;
  readonly sortOrder: number;
  readonly archived: boolean;
}

export interface CreateCategoryRequest {
  /** Optional; derived from the name when omitted. Immutable afterwards. */
  readonly categoryId?: Category | undefined;
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: MemberColor;
}

export interface UpdateCategoryRequest {
  readonly name?: string | undefined;
  readonly icon?: CategoryIcon | undefined;
  readonly color?: MemberColor | undefined;
  /** New 0-based position. */
  readonly sortOrder?: number | undefined;
  readonly archived?: boolean | undefined;
}
