/** Card wrapper for one settings section (FRONTEND-008). */

import { Card, CardContent, Typography } from "@mui/material";
import { useId, type ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  const headingId = useId();
  return (
    <Card component="section" aria-labelledby={headingId} sx={{ mb: 2 }}>
      <CardContent>
        <Typography id={headingId} variant="h2" component="h2" sx={{ mb: description ? 0.5 : 2 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
