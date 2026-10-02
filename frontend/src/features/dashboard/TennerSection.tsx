import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useId } from "react";

export interface TennerSectionProps {
  readonly title: string;
  readonly count: number;
  readonly children: ReactNode;
}

/** A titled list section on the dashboard. Renders nothing when empty (no empty tables). */
export function TennerSection({ title, count, children }: TennerSectionProps) {
  const headingId = useId();
  if (count === 0) return null;
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ mb: 3 }}>
      <Typography variant="h2" id={headingId} sx={{ mb: 1.5 }}>
        {title}{" "}
        <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
          ({count})
        </Box>
      </Typography>
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
        {children}
      </Stack>
    </Box>
  );
}
