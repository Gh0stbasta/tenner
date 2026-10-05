/** Assignee and minutes on Tenner cards; shared Tenners get a distinct marker (HOUSEHOLD-002). */

import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { Box, Typography } from "@mui/material";
import { SHARED_ASSIGNEE, type UserId } from "../../types/domain";
import { formatMinutes } from "../../utils/format";
import { useMemberName } from "./api";

export function AssigneeLabel({
  assignedTo,
  estimatedMinutes,
}: {
  readonly assignedTo: UserId;
  readonly estimatedMinutes: number;
}) {
  const memberName = useMemberName();
  const label = `${memberName(assignedTo)} · ${formatMinutes(estimatedMinutes)}`;
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
