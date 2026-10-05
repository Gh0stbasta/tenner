/** Card for one analytics section: own loading and error state, hidden when its endpoint is unavailable. */

import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import { Alert, Box, Card, CardContent, IconButton, Skeleton, Tooltip, Typography } from "@mui/material";
import { useId, useState, type ReactNode } from "react";
import { errorMessage } from "../../api/errorMessages";
import { isUnavailable } from "./api";

export interface ChartSectionProps<T> {
  readonly title: string;
  readonly description?: string;
  readonly query: { readonly data: T | undefined; readonly isPending: boolean; readonly error: unknown };
  /** The visual form. */
  readonly children: (data: T) => ReactNode;
  /** Accessible alternative; when given, a toggle switches between chart and table. */
  readonly table?: (data: T) => ReactNode;
}

export function ChartSection<T>({ title, description, query, children, table }: ChartSectionProps<T>) {
  const titleId = useId();
  const [showTable, setShowTable] = useState(false);
  if (query.error && isUnavailable(query.error)) return null;
  return (
    <Card component="section" aria-labelledby={titleId} sx={{ height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography id={titleId} variant="h3" component="h2">
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          {table && query.data !== undefined && (
            <Tooltip title={showTable ? "Als Diagramm zeigen" : "Als Tabelle zeigen"}>
              <IconButton
                aria-label={showTable ? `${title} als Diagramm zeigen` : `${title} als Tabelle zeigen`}
                aria-pressed={showTable}
                onClick={() => setShowTable((value) => !value)}
              >
                {showTable ? <BarChartOutlinedIcon /> : <TableChartOutlinedIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {query.isPending ? (
          <Skeleton variant="rounded" height={160} aria-label={`${title} wird geladen`} />
        ) : query.error || query.data === undefined ? (
          <Alert severity="error">
            {title} konnte nicht geladen werden. {errorMessage(query.error)}
          </Alert>
        ) : showTable && table ? (
          table(query.data)
        ) : (
          children(query.data)
        )}
      </CardContent>
    </Card>
  );
}
