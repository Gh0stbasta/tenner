/** Quick Add workflow (FRONTEND-006): validate, check duplicates, create with defaults. */

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../api/queryKeys";
import { useNotify } from "../../components/NotificationProvider";
import type { Category } from "../../types/domain";
import { useCurrentUser } from "../completions/useCurrentUser";
import { DEFAULT_LIST_PARAMS, listTenners, useCreateTenner } from "./api";
import { findSimilarTenner, QUICK_ADD_DEFAULTS, suggestCategory } from "./quickAdd";
import type { Tenner } from "./schemas";
import { LIMITS } from "./tennerForm.schema";

export function validateQuickTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed) return "Titel ist erforderlich.";
  if (trimmed.length < LIMITS.titleMin) return `Der Titel braucht mindestens ${LIMITS.titleMin} Zeichen.`;
  if (trimmed.length > LIMITS.titleMax) return `Der Titel darf höchstens ${LIMITS.titleMax} Zeichen haben.`;
  return undefined;
}

export function useQuickAddTenner() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const assignedTo = useCurrentUser();
  const create = useCreateTenner();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [duplicate, setDuplicate] = useState<Tenner | null>(null);
  const [checking, setChecking] = useState(false);

  const suggestedCategory: Category | undefined = suggestCategory(title);

  const createNow = () => {
    const trimmed = title.trim();
    create.mutate(
      {
        ...QUICK_ADD_DEFAULTS,
        category: suggestCategory(trimmed) ?? QUICK_ADD_DEFAULTS.category,
        assignedTo,
        title: trimmed,
      },
      {
        onSuccess: (created) => {
          setTitle("");
          notify({ message: `✅ „${created.title}“ angelegt.` });
        },
        onError: () => setError("Tenner konnte nicht angelegt werden."),
      },
    );
  };

  const submit = async () => {
    const invalid = validateQuickTitle(title);
    setError(invalid);
    if (invalid || create.isPending) return;
    setChecking(true);
    try {
      const existing = await queryClient.fetchQuery({
        queryKey: queryKeys.tennerList(DEFAULT_LIST_PARAMS),
        queryFn: () => listTenners(DEFAULT_LIST_PARAMS),
      });
      const similar = findSimilarTenner(title, existing);
      if (similar) {
        setDuplicate(similar);
        return;
      }
    } catch {
      // Duplicate detection is best effort: creating must still work if the list cannot be loaded.
    } finally {
      setChecking(false);
    }
    createNow();
  };

  return {
    title,
    setTitle: (value: string) => {
      setTitle(value);
      if (error) setError(undefined);
    },
    error,
    suggestedCategory,
    busy: checking || create.isPending,
    duplicate,
    submit,
    confirmDuplicate: () => {
      setDuplicate(null);
      createNow();
    },
    cancelDuplicate: () => setDuplicate(null),
  };
}
