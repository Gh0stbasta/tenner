/** Period selection stored in the URL query string (ANALYTICS-009): ?period=month or ?from=…&to=…. */

import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { daysBetween } from "../../utils/dates";
import { PERIOD_OPTIONS, type Granularity, type PeriodOption, type PeriodSelection } from "./api";

export const DEFAULT_PERIOD: PeriodOption = "month";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reads the selection from query parameters; anything invalid falls back to the default. */
export function selectionFromParams(params: URLSearchParams): PeriodSelection {
  const from = params.get("from");
  const to = params.get("to");
  if (from && to && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to) return { from, to };
  const period = params.get("period");
  return {
    period: (PERIOD_OPTIONS as readonly string[]).includes(period ?? "") ? (period as PeriodOption) : DEFAULT_PERIOD,
  };
}

/** Bucket size that keeps the trend chart readable: days for a week, months for a year. */
export function granularityFor(selection: PeriodSelection): Granularity {
  if ("period" in selection)
    return selection.period === "week" ? "day" : selection.period === "year" ? "month" : "week";
  const days = daysBetween(selection.from, selection.to) + 1;
  return days <= 31 ? "day" : days <= 120 ? "week" : "month";
}

/** The selection from the URL and a setter that replaces the query string. */
export function usePeriodSelection(): [PeriodSelection, (selection: PeriodSelection) => void] {
  const [params, setParams] = useSearchParams();
  const select = useCallback(
    (selection: PeriodSelection) =>
      setParams("period" in selection ? { period: selection.period } : { from: selection.from, to: selection.to }, {
        replace: true,
      }),
    [setParams],
  );
  return [selectionFromParams(params), select];
}
