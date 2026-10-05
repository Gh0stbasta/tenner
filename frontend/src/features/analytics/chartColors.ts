/**
 * Chart colors (ANALYTICS-009). Categorical slots are assigned in fixed order and never cycled; light and dark steps
 * are separate selections validated against the app surfaces (#ffffff, #1c1f24) with the dataviz palette validator:
 * worst adjacent CVD ΔE 9.1 light / 8.4 dark, normal-vision ΔE ≥ 19.3. Slots 3–5 are below 3:1 on light, so charts
 * always carry direct labels or a table view. Member swatch colors are user-chosen and fail these checks, so charts
 * do not use them.
 */

import { useTheme } from "@mui/material";

const SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"] as const;
const SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"] as const;

/** Maximum series before the rest folds into "Weitere". */
export const MAX_SERIES = SERIES_LIGHT.length - 1;
/** Neutral color of the folded "Weitere" series. */
const OTHER = { light: "#8a8984", dark: "#8a8984" };

/** Status colors, always paired with an icon and a label. */
export const STATUS_COLORS = { good: "#0ca30c", warning: "#fab219", critical: "#d03b3b" } as const;

export interface ChartPalette {
  /** Color of categorical slot `index` (0-based); the fold color beyond MAX_SERIES. */
  readonly series: (index: number) => string;
  /** Recessive gridline / track color. */
  readonly grid: string;
}

export function useChartPalette(): ChartPalette {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const slots = dark ? SERIES_DARK : SERIES_LIGHT;
  return {
    series: (index) => (index < MAX_SERIES ? (slots[index] as string) : dark ? OTHER.dark : OTHER.light),
    grid: theme.palette.divider,
  };
}
