import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import { Button, Chip, Stack } from "@mui/material";
import { PageHeader } from "../../components/PageHeader";
import { CATEGORY_LABELS, USER_LABELS } from "../../types/domain";
import { useToday } from "../household/api";
import { CompleteTennerButton } from "../completions/CompleteTennerButton";
import { SnoozedBadge } from "../snooze/SnoozedBadge";
import { SnoozeMenu } from "../snooze/SnoozeMenu";
import type { Tenner } from "../tenners/schemas";
import { tennerStatus } from "../tenners/status";
import { TennerStatusBadge } from "../tenners/TennerStatusBadge";

export interface TennerDetailHeaderProps {
  readonly tenner: Tenner;
  readonly busy: boolean;
  readonly onEdit: () => void;
  readonly onArchive: () => void;
  readonly onRestore: () => void;
}

export function TennerDetailHeader({ tenner, busy, onEdit, onArchive, onRestore }: TennerDetailHeaderProps) {
  const today = useToday();
  const status = tennerStatus(tenner, today);
  const archived = status.kind === "archived";
  return (
    <PageHeader
      title={tenner.title}
      subtitle={
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: "wrap", alignItems: "center", mt: 0.5 }}
          aria-label="Status"
        >
          <Chip size="small" label={CATEGORY_LABELS[tenner.category]} />
          <span>{USER_LABELS[tenner.assignedTo]}</span>
          <TennerStatusBadge status={status} />
          <SnoozedBadge snoozedUntil={tenner.snoozedUntil} />
        </Stack>
      }
      actions={
        archived ? (
          <Button startIcon={<UnarchiveOutlinedIcon />} onClick={onRestore} disabled={busy}>
            Wiederherstellen
          </Button>
        ) : (
          <>
            <CompleteTennerButton tenner={tenner} disabled={busy || !tenner.active} />
            {(status.kind === "overdue" || status.kind === "dueToday") && (
              <SnoozeMenu tenner={tenner} disabled={busy} />
            )}
            <Button startIcon={<EditOutlinedIcon />} onClick={onEdit} disabled={busy}>
              Bearbeiten
            </Button>
            <Button startIcon={<ArchiveOutlinedIcon />} color="error" onClick={onArchive} disabled={busy}>
              Archivieren
            </Button>
          </>
        )
      }
    />
  );
}
