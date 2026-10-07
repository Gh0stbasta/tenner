/** Household task catalog import (DATA-008): POST /household/catalog. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";

const catalogImportSchema = z.object({
  dryRun: z.boolean(),
  membersCreated: z.array(z.string()),
  tennersCreated: z.array(z.string()),
  tennersSkipped: z.array(z.string()),
});
export type CatalogImport = z.infer<typeof catalogImportSchema>;

export function importCatalog(dryRun: boolean): Promise<CatalogImport> {
  return apiClient.post("/household/catalog", { schema: catalogImportSchema, body: { dryRun } });
}

/** Dry run: what the import would add. */
export function useCatalogPreview() {
  return useMutation({ mutationFn: () => importCatalog(true) });
}

/** The import; afterwards members, Tenners and the dashboard are reloaded. */
export function useImportCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => importCatalog(false),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.members }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenners }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]),
  });
}
