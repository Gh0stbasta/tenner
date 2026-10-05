/** A Tenner in the management list (FRONTEND-003): details, status and actions. */

import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutlineOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { TennerLink } from "../../components/TennerLink";
import { useCategoryName } from "../categories/api";
import { CompleteTennerButton } from "../completions/CompleteTennerButton";
import { formatMinutes, formatShortDate } from "../../utils/format";
import { useToday } from "../household/api";
import { isPausedIndividually } from "../pause/pauseStatus";
import type { Tenner } from "./schemas";
import { frequencyLabel, type TennerStatus } from "./status";
import { TennerStatusBadge } from "./TennerStatusBadge";
import { useMemberName } from "../members/api";

export interface TennerCardActions {
  readonly onEdit?: (tenner: Tenner) => void;
  readonly onArchive?: (tenner: Tenner) => void;
  readonly onRestore?: (tenner: Tenner) => void;
  /** SCHEDULING-005: offered when the Tenner is not paused individually. */
  readonly onPause?: (tenner: Tenner) => void;
  /** SCHEDULING-005: offered while the Tenner is paused individually. */
  readonly onResume?: (tenner: Tenner) => void;
}

export interface TennerCardProps extends TennerCardActions {
  readonly tenner: Tenner;
  readonly status: TennerStatus;
  readonly busy?: boolean;
}

export function TennerCard({
  tenner,
  status,
  busy = false,
  onEdit,
  onArchive,
  onRestore,
  onPause,
  onResume,
}: TennerCardProps) {
  const categoryName = useCategoryName();
  const memberName = useMemberName();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("sm"));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const archived = status.kind === "archived";
  const pausedIndividually = isPausedIndividually(tenner, useToday());
  const canPause = !archived && tenner.active;
  const name = `„${tenner.title}“`;

  const secondary = [
    !archived &&
      onEdit && { label: "Bearbeiten", icon: <EditOutlinedIcon fontSize="small" />, run: () => onEdit(tenner) },
    canPause &&
      !pausedIndividually &&
      onPause && { label: "Pausieren", icon: <PauseCircleOutlineIcon fontSize="small" />, run: () => onPause(tenner) },
    canPause &&
      pausedIndividually &&
      onResume && {
        label: "Fortsetzen",
        icon: <PlayCircleOutlineIcon fontSize="small" />,
        run: () => onResume(tenner),
      },
    !archived &&
      onArchive && {
        label: "Archivieren",
        icon: <ArchiveOutlinedIcon fontSize="small" />,
        run: () => onArchive(tenner),
      },
  ].filter((action) => action !== false && action !== undefined);

  return (
    <Card
      component="li"
      sx={{ listStyle: "none", height: "100%", display: "flex", flexDirection: "column", opacity: archived ? 0.75 : 1 }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "flex-start" }}>
          <Typography variant="h3" component="h3" sx={{ overflowWrap: "anywhere" }}>
            <TennerLink tennerId={tenner.tennerId}>{tenner.title}</TennerLink>
          </Typography>
          <TennerStatusBadge status={status} />
        </Box>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>
          <Chip size="small" label={categoryName(tenner.category)} />
          <Typography variant="body2" color="text.secondary">
            {memberName(tenner.assignedTo)} · {formatMinutes(tenner.estimatedMinutes)}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {frequencyLabel(tenner)} · Fällig: {formatShortDate(tenner.nextDue)}
        </Typography>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, pt: 0, flexWrap: "wrap", gap: 1 }}>
        {archived ? (
          onRestore && (
            <Button
              startIcon={<UnarchiveOutlinedIcon />}
              onClick={() => onRestore(tenner)}
              disabled={busy}
              aria-label={`${name} wiederherstellen`}
            >
              Wiederherstellen
            </Button>
          )
        ) : (
          <CompleteTennerButton tenner={tenner} disabled={busy || !tenner.active} />
        )}
        {secondary.length > 0 &&
          (compact ? (
            <>
              <IconButton
                aria-label={`Weitere Aktionen für ${name}`}
                aria-haspopup="menu"
                onClick={(event) => setMenuAnchor(event.currentTarget)}
                sx={{ ml: "auto" }}
              >
                <MoreVertIcon />
              </IconButton>
              <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
                {secondary.map((action) => (
                  <MenuItem
                    key={action.label}
                    onClick={() => {
                      setMenuAnchor(null);
                      action.run();
                    }}
                  >
                    <ListItemIcon>{action.icon}</ListItemIcon>
                    {action.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          ) : (
            secondary.map((action) => (
              <Button
                key={action.label}
                startIcon={action.icon}
                onClick={action.run}
                disabled={busy}
                aria-label={`${name} ${action.label.toLowerCase()}`}
              >
                {action.label}
              </Button>
            ))
          ))}
      </CardActions>
    </Card>
  );
}
