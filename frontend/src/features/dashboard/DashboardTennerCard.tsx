/** One Tenner on the dashboard: title, meta data, status, and the complete and snooze actions. */

import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { TennerLink } from "../../components/TennerLink";
import { useCategoryName } from "../categories/api";
import { formatMinutes } from "../../utils/format";
import { CompleteTennerButton } from "../completions/CompleteTennerButton";
import { SnoozedBadge } from "../snooze/SnoozedBadge";
import { SnoozeMenu } from "../snooze/SnoozeMenu";
import type { DashboardTenner } from "./api";
import { useMemberName } from "../members/api";

export type DashboardCardVariant = "dueToday" | "overdue" | "upcoming";

export interface DashboardTennerCardProps {
  readonly tenner: DashboardTenner;
  readonly variant: DashboardCardVariant;
  /** Status text, e.g. "seit 3 Tagen überfällig". */
  readonly status?: string;
  /** Show the complete and snooze actions (due today and overdue). */
  readonly completable?: boolean;
}

const ACCENT: Readonly<Record<DashboardCardVariant, string>> = {
  dueToday: "primary.main",
  overdue: "error.main",
  upcoming: "divider",
};

export function DashboardTennerCard({ tenner, variant, status, completable = false }: DashboardTennerCardProps) {
  const categoryName = useCategoryName();
  const memberName = useMemberName();
  return (
    <Card component="li" sx={{ listStyle: "none", borderLeft: 4, borderLeftColor: ACCENT[variant] }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h3" component="h3" sx={{ overflowWrap: "anywhere" }}>
            <TennerLink tennerId={tenner.tennerId}>{tenner.title}</TennerLink>
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Chip size="small" label={categoryName(tenner.category)} />
            <Typography variant="body2" color="text.secondary">
              {memberName(tenner.assignedTo)} · {formatMinutes(tenner.estimatedMinutes)}
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
            <SnoozedBadge snoozedUntil={tenner.snoozedUntil} />
          </Stack>
        </Box>
        {completable && (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
            <SnoozeMenu tenner={tenner} variant="icon" />
            <CompleteTennerButton tenner={tenner} color={variant === "overdue" ? "error" : "primary"} />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
