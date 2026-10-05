import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutlineOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import { Button, Chip, Stack } from "@mui/material";
import { PageHeader } from "../../components/PageHeader";
import { useCategoryName } from "../categories/api";
import { useHouseholdVacation, useToday } from "../household/api";
import { isPausedIndividually } from "../pause/pauseStatus";
import { CompleteTennerButton } from "../completions/CompleteTennerButton";
import { SnoozedBadge } from "../snooze/SnoozedBadge";
import { SnoozeMenu } from "../snooze/SnoozeMenu";
import type { Tenner } from "../tenners/schemas";
import { tennerStatus } from "../tenners/status";
import { TennerStatusBadge } from "../tenners/TennerStatusBadge";
import { useMemberName } from "../members/api";

export interface TennerDetailHeaderProps {
  readonly tenner: Tenner;
  readonly busy: boolean;
  readonly onEdit: () => void;
  readonly onArchive: () => void;
  readonly onRestore: () => void;
  /** SCHEDULING-005 */
  readonly onPause: () => void;
  readonly onResume: () => void;
}

export function TennerDetailHeader({
  tenner,
  busy,
  onEdit,
  onArchive,
  onRestore,
  onPause,
  onResume,
}: TennerDetailHeaderProps) {
  const categoryName = useCategoryName();
  const memberName = useMemberName();
  const today = useToday();
  const status = tennerStatus(tenner, today, useHouseholdVacation());
  const pausedIndividually = isPausedIndividually(tenner, today);
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
          <Chip size="small" label={categoryName(tenner.category)} />
          <span>{memberName(tenner.assignedTo)}</span>
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
            {tenner.active &&
              (pausedIndividually ? (
                <Button startIcon={<PlayCircleOutlineIcon />} onClick={onResume} disabled={busy}>
                  Fortsetzen
                </Button>
              ) : (
                <Button startIcon={<PauseCircleOutlineIcon />} onClick={onPause} disabled={busy}>
                  Pausieren
                </Button>
              ))}
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
