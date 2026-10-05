/**
 * Assignee and minutes on Tenner cards; shared Tenners get a distinct marker (HOUSEHOLD-002), covered Tenners name
 * the member they are covered for (HOUSEHOLD-004).
 */

import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { Box, Typography } from "@mui/material";
import { SHARED_ASSIGNEE, type UserId } from "../../types/domain";
import { formatMinutes } from "../../utils/format";
import { useMemberName } from "./api";

export function AssigneeLabel({
  assignedTo,
  originalAssignee = null,
  estimatedMinutes,
}: {
  readonly assignedTo: UserId;
  readonly originalAssignee?: UserId | null;
  readonly estimatedMinutes: number;
}) {
  const memberName = useMemberName();
  const cover = originalAssignee === null ? "" : ` (für ${memberName(originalAssignee)})`;
  const label = `${memberName(assignedTo)}${cover} · ${formatMinutes(estimatedMinutes)}`;
  if (assignedTo !== SHARED_ASSIGNEE) {
    return (
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    );
  }
  return (
    <Typography variant="body2" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <GroupsOutlinedIcon fontSize="small" color="secondary" aria-hidden />
      <Box component="span" sx={{ color: "secondary.main", fontWeight: 600 }}>
        {label}
      </Box>
    </Typography>
  );
}
