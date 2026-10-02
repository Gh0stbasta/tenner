/** Quick Add widget (FRONTEND-006) for the dashboard and the Tenners page. */

import { Card, CardContent } from "@mui/material";
import { CATEGORY_LABELS } from "../../types/domain";
import { formatMinutes } from "../../utils/format";
import { DuplicateWarningDialog } from "./DuplicateWarningDialog";
import { QUICK_ADD_DEFAULTS } from "./quickAdd";
import { QuickAddInput } from "./QuickAddInput";
import { useQuickAddTenner } from "./useQuickAddTenner";

export function QuickAddTenner() {
  const quickAdd = useQuickAddTenner();
  const category = quickAdd.suggestedCategory ?? QUICK_ADD_DEFAULTS.category;
  const hint = `${CATEGORY_LABELS[category]}${quickAdd.suggestedCategory ? " (vorgeschlagen)" : ""} · ${formatMinutes(QUICK_ADD_DEFAULTS.estimatedMinutes)} · alle ${QUICK_ADD_DEFAULTS.frequencyDays} Tage – später änderbar`;

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
