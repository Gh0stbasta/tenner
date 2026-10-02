/** Empty states (FRONTEND-001): friendly message instead of empty tables. */

import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CelebrationOutlinedIcon from "@mui/icons-material/CelebrationOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: "center", py: 6, px: 2, color: "text.secondary" }}>
      {icon !== undefined && <Box sx={{ fontSize: 48, mb: 1, "& svg": { fontSize: 48 } }}>{icon}</Box>}
      <Typography variant="h2" component="p" color="text.primary">
        {title}
      </Typography>
      {description !== undefined && <Typography sx={{ mt: 1 }}>{description}</Typography>}
      {action !== undefined && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

export function NoTennersFound({ action }: { readonly action?: ReactNode }) {
  return (
    <EmptyState
      icon={<AssignmentOutlinedIcon aria-hidden />}
      title="Keine Tenner gefunden"
      description="Passe die Filter an oder lege deinen ersten Tenner an."
      action={action}
    />
  );
}

export function NoDashboardData() {
  return (
    <EmptyState
      icon={<CelebrationOutlinedIcon aria-hidden />}
      title="🎉 Alles erledigt."
      description="Heute ist kein Tenner fällig."
    />
  );
}

export function NoAnalyticsAvailable() {
  return (
    <EmptyState
      icon={<InsightsOutlinedIcon aria-hidden />}
      title="Noch keine Auswertung"
      description="Sobald Tenner erledigt werden, erscheinen hier Auswertungen."
    />
  );
}
