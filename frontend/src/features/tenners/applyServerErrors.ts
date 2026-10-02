/** Map backend VALIDATION_ERROR details onto form fields, so users see them inline (FRONTEND-004, UX-005). */

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "../../api/errors";

/** Returns true if at least one detail was applied to a known field. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
): boolean {
  if (!isApiError(error) || error.code !== "VALIDATION_ERROR") return false;
  let applied = false;
  for (const detail of error.details) {
    const field = fields.find((name) => name === detail.field);
    if (field) {
      setError(field, { type: "server", message: detail.message });
      applied = true;
    }
  }
  return applied;
}
