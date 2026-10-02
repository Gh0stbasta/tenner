import { Box, Collapse, Stack, Typography } from "@mui/material";
import { useId, type ReactNode } from "react";
import { TransitionGroup } from "react-transition-group";
import type { DashboardTenner } from "./api";

export interface TennerSectionProps {
  readonly title: string;
  readonly items: readonly DashboardTenner[];
  readonly children: (tenner: DashboardTenner) => ReactNode;
}

/**
 * A titled list section on the dashboard. Renders nothing when empty (no empty tables).
 * Completed items collapse out subtly (FRONTEND-007 completion animation).
 */
export function TennerSection({ title, items, children }: TennerSectionProps) {
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ mb: 3 }}>
      <Typography variant="h2" id={headingId} sx={{ mb: 1.5 }}>
        {title}{" "}
        <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
          ({items.length})
        </Box>
      </Typography>
      <Stack component="ul" sx={{ p: 0, m: 0 }}>
        <TransitionGroup component={null}>
          {items.map((tenner) => (
            <Collapse key={tenner.tennerId} timeout={250}>
              <Box sx={{ pb: 1.5 }}>{children(tenner)}</Box>
            </Collapse>
          ))}
        </TransitionGroup>
      </Stack>
    </Box>
  );
}
