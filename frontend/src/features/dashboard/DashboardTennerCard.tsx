/** One Tenner on the dashboard: title, meta data, status and the complete action. */

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { CATEGORY_LABELS, USER_LABELS } from "../../types/domain";
import { formatMinutes } from "../../utils/format";
import type { DashboardTenner } from "./api";

export type DashboardCardVariant = "dueToday" | "overdue" | "upcoming";

export interface DashboardTennerCardProps {
  readonly tenner: DashboardTenner;
  readonly variant: DashboardCardVariant;
  /** Status text, e.g. "seit 3 Tagen überfällig". */
  readonly status?: string;
  readonly onComplete?: (tenner: DashboardTenner) => void;
  readonly completing?: boolean;
}

const ACCENT: Readonly<Record<DashboardCardVariant, string>> = {
  dueToday: "primary.main",
  overdue: "error.main",
  upcoming: "divider",
};

export function DashboardTennerCard({
  tenner,
  variant,
  status,
  onComplete,
  completing = false,
}: DashboardTennerCardProps) {
  return (
    <Card component="li" sx={{ listStyle: "none", borderLeft: 4, borderLeftColor: ACCENT[variant] }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h3" component="h3" sx={{ overflowWrap: "anywhere" }}>
            {tenner.title}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Chip size="small" label={CATEGORY_LABELS[tenner.category]} />
            <Typography variant="body2" color="text.secondary">
              {USER_LABELS[tenner.assignedTo]} · {formatMinutes(tenner.estimatedMinutes)}
            </Typography>
            {status !== undefined && (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: variant === "overdue" ? 600 : 400,
                  color: variant === "overdue" ? "error.main" : "text.secondary",
                }}
              >
                {status}
              </Typography>
            )}
          </Stack>
        </Box>
        {onComplete && (
          <Button
            variant={variant === "upcoming" ? "outlined" : "contained"}
            color={variant === "overdue" ? "error" : "primary"}
            startIcon={<CheckCircleIcon />}
            onClick={() => onComplete(tenner)}
            disabled={completing}
            aria-label={`„${tenner.title}“ erledigen`}
            sx={{ flexShrink: 0, minHeight: 44 }}
          >
            Erledigt
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
