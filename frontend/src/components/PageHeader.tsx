import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface PageHeaderProps {
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly actions?: ReactNode;
}

/** Page title with optional subtitle and actions; stacks on small screens. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        justifyContent: "space-between",
        gap: 2,
        mb: 3,
      }}
    >
      <Box>
        <Typography variant="h1">{title}</Typography>
        {subtitle !== undefined && (
          <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions !== undefined && <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
    </Box>
  );
}
