/** ANALYTICS-009: analytics page. */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fail, mockFetch, ok, type MockResponse } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { AnalyticsPage } from "./AnalyticsPage";
import { bucketLabel, formatPercent, niceMax } from "./format";
import { granularityFor, selectionFromParams } from "./period";

const range = { from: "2026-09-08", to: "2026-10-07" };
const summary = {
  period: range,
  completions: 214,
  totalActualMinutes: 2380,
  activeTenners: 42,
  distinctTennersCompleted: 37,
  overdueNow: 0,
  missed: 6,
  onTimeRate: 0.86,
  onTimeSamples: 120,
};
const trends = {
  granularity: "week",
  period: range,
  buckets: [
    { start: "2026-09-07", completions: 48, actualMinutes: 530 },
    { start: "2026-09-14", completions: 0, actualMinutes: 0 },
  ],
  comparison: { previousPeriod: range, previousPeriodCompletions: 180, changePercent: 18.9 },
};
const categories = {
  period: range,
  categories: [
    {
      category: "FITNESS",
      name: "Fitness",
      archived: false,
      activeTenners: 8,
      completions: 40,
      actualMinutes: 900,
      shareOfMinutes: 0.38,
      overdueNow: 1,
      healthScore: 0.88,
    },
    {
      category: "HOME",
      name: "Haus & Garten",
      archived: false,
      activeTenners: 4,
      completions: 2,
      actualMinutes: 20,
      shareOfMinutes: 0.01,
      overdueNow: 3,
      healthScore: 0.25,
    },
  ],
};
const balance = {
  period: range,
  byUser: [
    { userId: "STEFAN", displayName: "Stefan", shareOfMinutes: 0.54, shareOfAssignedLoad: 0.5 },
    { userId: "JULIA", displayName: "Julia", shareOfMinutes: 0.46, shareOfAssignedLoad: 0.5 },
  ],
  byCategory: [],
  balanceIndex: 0.92,
};
const neglected = {
  period: range,
  items: [
    {
      tennerId: "t-12",
      title: "Fensterbänke putzen",
      assignedTo: "JULIA",
      category: "HOME",
      daysOverdue: 21,
      daysSinceCompleted: 49,
      expectedCompletions: 6,
      actualCompletions: 2,
      fulfillmentRatio: 0.33,
      neglectScore: 0.68,
    },
  ],
};
const habits = {
  period: range,
  householdConsistency: 0.81,
  items: [
    {
      tennerId: "t-3",
      title: "Mobility Workout",
      currentStreak: 11,
      longestStreak: 18,
      consistencyScore: 0.88,
      trend: "IMPROVING",
    },
  ],
};
const time = {
  period: range,
  totalActualMinutes: 2380,
  averageMinutesPerWeek: 555,
  projectedMinutesPerWeek: 610,
  estimationAccuracy: null,
  reportedSamples: 0,
  tennersExceedingEstimate: [
    { tennerId: "t-7", title: "Fenster putzen", estimatedMinutes: 10, medianActualMinutes: 25, samples: 4 },
  ],
  tennersExceedingTenMinutes: 6,
};

/** All analytics endpoints for any period (matched by path only). */
function allRoutes(overrides: Record<string, MockResponse> = {}) {
  return mockFetch({
    "GET /household": ok({ timezone: "Europe/Berlin" }),
    "GET /analytics/summary": ok(summary),
    "GET /analytics/trends": ok(trends),
    "GET /analytics/categories": ok(categories),
    "GET /analytics/balance": ok(balance),
    "GET /analytics/neglected": ok(neglected),
    "GET /analytics/habits": ok(habits),
    "GET /analytics/time": ok(time),
    ...overrides,
  });
}

const section = async (name: string) => within(await screen.findByRole("region", { name }));
const analyticsCalls = (fetchMock: ReturnType<typeof mockFetch>, name: string) =>
  fetchMock.calls().filter((call) => call.key.startsWith(`GET /analytics/${name}`));

describe("AnalyticsPage", () => {
  it("renders every section from the endpoints (chart data mapping)", async () => {
    allRoutes();
    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });
    const kpis = await section("Kennzahlen");
    expect(await kpis.findByText("214")).toBeInTheDocument();
    expect(kpis.getByText("86 %")).toBeInTheDocument();
    expect(kpis.getByText("aus 120 Erledigungen")).toBeInTheDocument();
    expect(kpis.getByText("Nicht erledigt").parentElement).toHaveTextContent("6am Tag verpasst");

    const trend = await section("Verlauf");
    expect(
      await trend.findByRole("img", { name: "Erledigungen pro Woche, 48 Erledigungen insgesamt" }),
    ).toBeInTheDocument();
    expect(trend.getByText("+18,9 % gegenüber dem Zeitraum davor (180 Erledigungen).")).toBeInTheDocument();

    const areas = await section("Lebensbereiche");
    expect(await areas.findByText("900 Min.")).toBeInTheDocument();
    expect(areas.getByText("Gut")).toBeInTheDocument();
    expect(areas.getByText("Kritisch")).toBeInTheDocument();

    const share = await section("Verteilung im Haushalt");
    expect(await share.findByRole("img", { name: "Erledigte Minuten: Stefan 54 %, Julia 46 %" })).toBeInTheDocument();
    expect(within(share.getByRole("list", { name: "Legende" })).getAllByRole("listitem")).toHaveLength(2);
    expect(share.getByText("Ausgewogenheit: 92 % (100 % = alle gleich viel)")).toBeInTheDocument();

    const neglect = await section("Vernachlässigte Aufgaben");
    expect(await neglect.findByRole("link", { name: "Fensterbänke putzen" })).toHaveAttribute("href", "/tenners/t-12");
    expect(neglect.getByText("2 / 6")).toBeInTheDocument();

    const habit = await section("Gewohnheiten");
    expect(await habit.findByText("Besser")).toBeInTheDocument();
    expect(habit.getByText("81 %")).toBeInTheDocument();

    const timeCard = await section("Zeitaufwand");
    expect(await timeCard.findByText("610 Min.")).toBeInTheDocument();
    expect(timeCard.getByRole("link", { name: "Fenster putzen" })).toBeInTheDocument();
  });

  it("selects a period and keeps it in the URL query", async () => {
    const fetchMock = allRoutes();
    renderWithProviders(<AnalyticsPage />, { route: "/analytics?period=year" });
    expect(await screen.findByRole("button", { name: "Jahr" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(analyticsCalls(fetchMock, "trends").at(-1)?.key).toBe(
        "GET /analytics/trends?period=year&granularity=month",
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Woche" }));
    await waitFor(() =>
      expect(analyticsCalls(fetchMock, "summary").at(-1)?.key).toBe("GET /analytics/summary?period=week"),
    );
    expect(analyticsCalls(fetchMock, "trends").at(-1)?.key).toBe("GET /analytics/trends?period=week&granularity=day");
  });

  it("supports a custom range", async () => {
    const fetchMock = allRoutes();
    renderWithProviders(<AnalyticsPage />, { route: "/analytics?from=2026-01-01&to=2026-03-31" });
    expect(await screen.findByRole("button", { name: "Eigener Zeitraum" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Von")).toHaveValue("2026-01-01");
    await waitFor(() =>
      expect(analyticsCalls(fetchMock, "trends").at(-1)?.key).toBe(
        "GET /analytics/trends?from=2026-01-01&to=2026-03-31&granularity=week",
      ),
    );
    await userEvent.clear(screen.getByLabelText("Von"));
    await userEvent.type(screen.getByLabelText("Von"), "2026-02-01");
    await waitFor(() =>
      expect(analyticsCalls(fetchMock, "summary").at(-1)?.key).toBe(
        "GET /analytics/summary?from=2026-02-01&to=2026-03-31",
      ),
    );
  });

  it("shows loading states per section", async () => {
    mockFetch({
      "GET /household": ok({ timezone: "Europe/Berlin" }),
      "GET /analytics/trends": ok(trends),
      // Never answers: this section stays in its loading state while the others finish.
      "GET /analytics/categories": () => new Promise<MockResponse>(() => undefined),
    });
    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });
    expect(screen.getByLabelText("Verlauf wird geladen")).toBeInTheDocument();
    expect(await (await section("Verlauf")).findByRole("img")).toBeInTheDocument();
    expect(screen.getByLabelText("Lebensbereiche wird geladen")).toBeInTheDocument();
  });

  it("fails sections independently and hides unavailable ones", async () => {
    allRoutes({
      "GET /analytics/balance": fail(500, "INTERNAL_ERROR"),
      "GET /analytics/habits": fail(404, "NOT_FOUND", "Route not found."),
    });
    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });
    const share = await section("Verteilung im Haushalt");
    expect(
      await share.findByText(/^Verteilung im Haushalt konnte nicht geladen werden\./, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(await (await section("Verlauf")).findByRole("img")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Gewohnheiten" })).not.toBeInTheDocument());
  });

  it("offers an accessible table instead of each chart", async () => {
    allRoutes();
    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });
    const trend = await section("Verlauf");
    await userEvent.click(await trend.findByRole("button", { name: "Verlauf als Tabelle zeigen" }));
    const table = trend.getByRole("table", { name: "Verlauf als Tabelle" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("530")).toBeInTheDocument();
    expect(trend.getByRole("button", { name: "Verlauf als Diagramm zeigen" })).toHaveAttribute("aria-pressed", "true");
    const share = await section("Verteilung im Haushalt");
    await userEvent.click(share.getByRole("button", { name: "Verteilung im Haushalt als Tabelle zeigen" }));
    expect(within(share.getByRole("table")).getByText("54 %")).toBeInTheDocument();
  });

  it("lays out sections in a responsive grid", async () => {
    allRoutes();
    const { container } = renderWithProviders(<AnalyticsPage />, { route: "/analytics" });
    await screen.findByRole("region", { name: "Zeitaufwand" });
    // Charts: one column on phones, two from md; the two tables always span the full width.
    expect(container.querySelectorAll(".MuiGrid-grid-xs-12.MuiGrid-grid-md-6")).toHaveLength(4);
    expect(container.querySelectorAll(".MuiGrid-grid-xs-12:not(.MuiGrid-grid-md-6)")).toHaveLength(2);
  });
});

describe("period helpers", () => {
  it("reads the selection from the URL with a safe default", () => {
    expect(selectionFromParams(new URLSearchParams("period=quarter"))).toEqual({ period: "quarter" });
    expect(selectionFromParams(new URLSearchParams("from=2026-01-01&to=2026-01-31"))).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(selectionFromParams(new URLSearchParams("period=decade"))).toEqual({ period: "month" });
    expect(selectionFromParams(new URLSearchParams("from=2026-02-01&to=2026-01-01"))).toEqual({ period: "month" });
  });

  it("chooses a readable granularity", () => {
    expect(granularityFor({ period: "week" })).toBe("day");
    expect(granularityFor({ period: "month" })).toBe("week");
    expect(granularityFor({ period: "year" })).toBe("month");
    expect(granularityFor({ from: "2026-01-01", to: "2026-01-31" })).toBe("day");
    expect(granularityFor({ from: "2026-01-01", to: "2026-03-31" })).toBe("week");
    expect(granularityFor({ from: "2026-01-01", to: "2026-12-31" })).toBe("month");
  });

  it("formats axis values, percentages and bucket labels", () => {
    expect([niceMax(0), niceMax(7), niceMax(48), niceMax(130)]).toEqual([1, 10, 50, 200]);
    expect([formatPercent(0.856), formatPercent(null)]).toEqual(["86 %", "–"]);
    expect(bucketLabel("2026-10-01", "month").long).toBe("Oktober 2026");
    expect(bucketLabel("2026-09-07", "week").long).toMatch(/^Woche ab /);
  });
});
