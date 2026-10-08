/** Quick Add widget (FRONTEND-006) for the dashboard and the Tenners page. */

import { Card, CardContent } from "@mui/material";
import { useSearchParams } from "react-router";
import { useCategoryName } from "../categories/api";
import { formatMinutes } from "../../utils/format";
import { DuplicateWarningDialog } from "./DuplicateWarningDialog";
import { QuickAddInput } from "./QuickAddInput";
import { useQuickAddTenner } from "./useQuickAddTenner";

export function QuickAddTenner() {
  const quickAdd = useQuickAddTenner();
  // The home-screen shortcut "Neue Aufgabe" opens /tenners?quickAdd=1 (MOBILE-001; on „Aufgaben“ since UI-001).
  const [params] = useSearchParams();
  const { defaults } = quickAdd;
  const categoryName = useCategoryName();
  const category = quickAdd.suggestedCategory ?? defaults.category;
  const hint = `${categoryName(category)}${quickAdd.suggestedCategory ? " (vorgeschlagen)" : ""} · ${formatMinutes(defaults.estimatedMinutes)} · alle ${defaults.frequencyDays} Tage – später änderbar`;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
        <QuickAddInput
          value={quickAdd.title}
          error={quickAdd.error}
          helperText={quickAdd.title.trim() ? hint : undefined}
          busy={quickAdd.busy}
          onChange={quickAdd.setTitle}
          onSubmit={() => void quickAdd.submit()}
          autoFocus={params.get("quickAdd") === "1"}
        />
      </CardContent>
      <DuplicateWarningDialog
        similar={quickAdd.duplicate}
        onCreateAnyway={quickAdd.confirmDuplicate}
        onCancel={quickAdd.cancelDuplicate}
      />
    </Card>
  );
}
