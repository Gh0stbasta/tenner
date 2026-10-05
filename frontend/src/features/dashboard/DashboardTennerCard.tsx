/** One Tenner on the dashboard: title, meta data, status, and the complete and snooze actions. */

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SnoozeIcon from "@mui/icons-material/Snooze";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useRef } from "react";
import { TennerLink } from "../../components/TennerLink";
import { useCategoryName } from "../categories/api";
import { CompleteTennerButton } from "../completions/CompleteTennerButton";
import { useCompletion } from "../completions/CompletionProvider";
import { SWIPE_THRESHOLD, useSwipe } from "../mobile/useSwipe";
import { SnoozedBadge } from "../snooze/SnoozedBadge";
import { SnoozeMenu } from "../snooze/SnoozeMenu";
import type { DashboardTenner } from "./api";
import { AssigneeLabel } from "../members/AssigneeLabel";

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

/**
 * Completable cards can be swiped on touch screens (MOBILE-005): right completes, left opens the snooze menu. The
 * buttons on the card stay the accessible alternative.
 */
export function DashboardTennerCard({ tenner, variant, status, completable = false }: DashboardTennerCardProps) {
  const categoryName = useCategoryName();
  const { complete, isCompleting } = useCompletion();
  const snoozeButton = useRef<HTMLButtonElement>(null);
  const swipe = useSwipe({
    enabled: completable && !isCompleting(tenner.tennerId),
    onSwipeRight: () => complete({ tennerId: tenner.tennerId, title: tenner.title }),
    onSwipeLeft: () => snoozeButton.current?.click(),
  });
  const reached = Math.abs(swipe.offset) >= SWIPE_THRESHOLD;
  return (
    <Box component="li" sx={{ listStyle: "none", position: "relative", borderRadius: 1, overflow: "hidden" }}>
      {swipe.offset !== 0 && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: swipe.offset > 0 ? "flex-start" : "flex-end",
            px: 2,
            gap: 1,
            color: "common.white",
            bgcolor:
              swipe.offset > 0
                ? reached
                  ? "success.main"
                  : "success.light"
                : reached
                  ? "warning.main"
                  : "warning.light",
          }}
        >
          {swipe.offset > 0 ? <CheckCircleIcon /> : <SnoozeIcon />}
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {swipe.offset > 0 ? "Erledigt" : "Verschieben"}
          </Typography>
        </Box>
      )}
      <Card
        {...swipe.handlers}
        sx={{
          borderLeft: 4,
          borderLeftColor: ACCENT[variant],
          position: "relative",
          transform: swipe.offset === 0 ? undefined : `translateX(${swipe.offset}px)`,
          transition: swipe.offset === 0 ? "transform 150ms ease-out" : "none",
          // Horizontal gestures belong to the card; vertical ones still scroll the page.
          touchAction: completable ? "pan-y" : undefined,
        }}
      >
        <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, "&:last-child": { pb: 2 } }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h3" component="h3" sx={{ overflowWrap: "anywhere" }}>
              <TennerLink tennerId={tenner.tennerId}>{tenner.title}</TennerLink>
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Chip size="small" label={categoryName(tenner.category)} />
              <AssigneeLabel
                assignedTo={tenner.assignedTo}
                originalAssignee={tenner.originalAssignee}
                estimatedMinutes={tenner.estimatedMinutes}
              />
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
              <SnoozeMenu tenner={tenner} variant="icon" buttonRef={snoozeButton} />
              <CompleteTennerButton tenner={tenner} color={variant === "overdue" ? "error" : "primary"} />
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
