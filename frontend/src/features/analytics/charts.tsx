/**
 * Small HTML chart primitives (ANALYTICS-009), styled after the dataviz mark specs: bars ≤ 24px thick with a 4px
 * rounded data end, square at the baseline; a 2px surface gap between touching marks; hairline grid; text in text
 * colors, never in the series color. Every mark is focusable and has a tooltip; values stay reachable via labels or
 * the table view.
 */

import { Box, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { formatPercent, niceMax } from "./format";

const BAR = 24;
const RADIUS = "4px";

export interface Column {
  readonly key: string;
  /** Short axis label. */
  readonly label: string;
  readonly value: number;
  /** Tooltip and accessible text, e.g. "Woche ab 7. Sept.: 12 Erledigungen". */
  readonly description: string;
}

/** Vertical columns from one baseline, one series (no legend: the section title names it). */
export function ColumnChart({
  columns,
  color,
  height = 160,
  ariaLabel,
}: {
  readonly columns: readonly Column[];
  readonly color: string;
  readonly height?: number;
  readonly ariaLabel: string;
}) {
  const max = niceMax(Math.max(0, ...columns.map((column) => column.value)));
  // Label at most ~8 ticks so the axis never collides.
  const every = Math.max(1, Math.ceil(columns.length / 8));
  // One grid: the y-axis column, then one column per bucket; the axis labels share the bar's column, so they align.
  return (
    <Box
      role="img"
      aria-label={ariaLabel}
      sx={{ display: "grid", gridTemplateColumns: `auto repeat(${columns.length}, minmax(0, 1fr))`, columnGap: "2px" }}
    >
      <Box
        aria-hidden
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height,
          pr: 1,
          textAlign: "right",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {max}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          0
        </Typography>
      </Box>
      {columns.map((column) => (
        <Tooltip key={column.key} title={column.description} placement="top">
          <Box
            tabIndex={0}
            role="presentation"
            aria-label={column.description}
            sx={{
              height,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              borderTop: 1,
              borderBottom: 1,
              borderColor: "divider",
              outline: "none",
              "&:hover > *, &:focus-visible > *": { opacity: 0.8 },
            }}
          >
            <Box
              sx={{
                width: "100%",
                maxWidth: BAR,
                height: `${(column.value / max) * 100}%`,
                bgcolor: color,
                borderRadius: `${RADIUS} ${RADIUS} 0 0`,
                minHeight: column.value > 0 ? 2 : 0,
              }}
            />
          </Box>
        </Tooltip>
      ))}
      <Box aria-hidden />
      {columns.map((column, index) => (
        <Typography
          key={column.key}
          aria-hidden
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: "center", whiteSpace: "nowrap" }}
        >
          {index % every === 0 ? column.label : ""}
        </Typography>
      ))}
    </Box>
  );
}

export interface BarRow {
  readonly key: string;
  readonly label: ReactNode;
  readonly value: number;
  /** Text at the bar tip. */
  readonly valueLabel: string;
  readonly description: string;
  /** Extra content after the value (e.g. a status chip). */
  readonly extra?: ReactNode;
}

/** Horizontal bars, one series, value at the tip. */
export function BarList({ rows, color }: { readonly rows: readonly BarRow[]; readonly color: string }) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1 }}>
      {rows.map((row) => (
        <Box
          component="li"
          key={row.key}
          sx={{ display: "grid", gridTemplateColumns: "minmax(7rem, 30%) 1fr", alignItems: "center", gap: 1 }}
        >
          <Typography variant="body2" noWrap>
            {row.label}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Tooltip title={row.description}>
              <Box
                tabIndex={0}
                aria-label={row.description}
                sx={{
                  height: 16,
                  width: `${max === 0 ? 0 : (row.value / max) * 70}%`,
                  minWidth: row.value > 0 ? 4 : 0,
                  bgcolor: color,
                  borderRadius: `0 ${RADIUS} ${RADIUS} 0`,
                  outline: "none",
                  "&:hover, &:focus-visible": { opacity: 0.8 },
                }}
              />
            </Tooltip>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {row.valueLabel}
            </Typography>
            {row.extra}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export interface Segment {
  readonly key: string;
  readonly label: string;
  /** Share 0–1. */
  readonly share: number;
  readonly color: string;
}

/** A 100 % bar split into segments with a 2px surface gap; identity comes from the legend below. */
export function StackedBar({
  segments,
  ariaLabel,
}: {
  readonly segments: readonly Segment[];
  readonly ariaLabel: string;
}) {
  // The container rounds the outer ends; segments stay square so the 2px gaps read evenly.
  return (
    <Box
      role="img"
      aria-label={ariaLabel}
      sx={{ display: "flex", gap: "2px", height: 20, borderRadius: RADIUS, overflow: "hidden" }}
    >
      {segments
        .filter((segment) => segment.share > 0)
        .map((segment) => (
          <Tooltip key={segment.key} title={`${segment.label}: ${formatPercent(segment.share)}`}>
            <Box
              tabIndex={0}
              aria-label={`${segment.label}: ${formatPercent(segment.share)}`}
              sx={{
                flexGrow: segment.share,
                flexBasis: 0,
                bgcolor: segment.color,
                outline: "none",
                "&:hover, &:focus-visible": { opacity: 0.8 },
              }}
            />
          </Tooltip>
        ))}
    </Box>
  );
}

/** Legend with a rectangle key per series (mirrors the bar marks); text stays in text colors. */
export function Legend({
  items,
}: {
  readonly items: readonly { readonly key: string; readonly label: string; readonly color: string }[];
}) {
  return (
    <Box
      component="ul"
      aria-label="Legende"
      sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: 2 }}
    >
      {items.map((item) => (
        <Box component="li" key={item.key} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: "2px", bgcolor: item.color }} />
          <Typography variant="body2">{item.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Plain data table (the accessible alternative of every chart). */
export function DataTable({
  caption,
  head,
  rows,
}: {
  readonly caption: string;
  readonly head: readonly string[];
  readonly rows: readonly (readonly ReactNode[])[];
}) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small" aria-label={caption}>
        <TableHead>
          <TableRow>
            {head.map((cell, index) => (
              <TableCell key={cell} align={index === 0 ? "left" : "right"}>
                {cell}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, index) => (
                <TableCell key={index} align={index === 0 ? "left" : "right"}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
