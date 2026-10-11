/** Dashboard (UI-001): today's meals, today's Aufgaben as checklist, shopping for tomorrow — nothing else. */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeResponse, dashboard, mealPlanFixture } from "../../tests/fixtures";
import { fail, mockFetch, ok, type MockResponse } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import type { ShoppingItem } from "../meals/api";
import { DashboardPage } from "./DashboardPage";
import { itemsFor } from "../meals/shopping";

const item = (key: string, name: string, usedFor: string[], extra: Partial<ShoppingItem> = {}): ShoppingItem => ({
  key,
  ingredientId: key,
  name,
  quantity: 1,
  unit: "Stück",
  section: "TROCKENWAREN",
  pantry: false,
  checked: false,
  manual: false,
  usedFor,
  ...extra,
});

const SHOPPING = {
  weekStart: "2026-10-12",
  range: "REST",
  generatedAt: "2026-10-12T05:00:00Z",
  stale: false,
  items: [
    item("milk", "Milch", ["2026-10-15#DINNER"]),
    item("pasta", "Spaghetti", ["2026-10-15#LUNCH", "2026-10-17#DINNER"], { quantity: 2 }),
    item("eggs", "Eier", ["2026-10-15#LUNCH"], { checked: true }),
    item("rice", "Reis", ["2026-10-17#LUNCH"]),
  ],
};

const HISTORY = {
  items: [
    { completionId: "c-1", tennerId: "t-9", tennerTitle: "Roboter EG", completedBy: "JULIA", completedAt: "2026-10-14T06:30:00Z", actualMinutes: 5, revertedAt: null },
    { completionId: "c-2", tennerId: "t-8", tennerTitle: "Gestern", completedBy: "JULIA", completedAt: "2026-10-13T06:30:00Z", actualMinutes: 5, revertedAt: null },
  ],
  nextCursor: null,
};

function routes(extra: Record<string, MockResponse | (() => MockResponse)> = {}) {
  return {
    "GET /dashboard": ok(dashboard()),
    "GET /history": ok(HISTORY),
    "GET /meals/plans/current": ok(mealPlanFixture()),
    "GET /meals/plans/current/shopping-list": ok(SHOPPING),
    ...extra,
  };
}

/** The fixture plan moved one week ahead (Monday 19 October); dishes are keyed by the fixture's dates. */
function nextWeekPlan(dishes: Record<string, string | null>) {
  const plan = mealPlanFixture({ dishes });
  const later = (date: string) => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + 7);
    return value.toISOString().slice(0, 10);
  };
  return {
    ...plan,
    weekStart: later(plan.weekStart),
    weekEnd: later(plan.weekEnd),
    slots: plan.slots.map((slot) => ({ ...slot, date: later(slot.date), slotId: `${later(slot.date)}#${slot.slot}` })),
  };
}

const region = async (name: string) => within(await screen.findByRole("region", { name }));

describe("DashboardPage (UI-001)", () => {
  beforeEach(() => {
    // Wednesday, 14 October 2026, 10:00.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("shows loading first", () => {
    mockFetch(routes());
    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole("status", { name: "Dashboard wird geladen" })).toBeInTheDocument();
  });

  it("shows the day: meals, today's Aufgaben and shopping for tomorrow", async () => {
    mockFetch(routes());
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Heute" })).toBeInTheDocument();
    expect(screen.getByText("Freitag, 2. Oktober")).toBeInTheDocument();

    expect(await (await region("Heute essen wir")).findByText("Linseneintopf")).toBeInTheDocument();

    const tasks = await region("Heute erledigen wir");
    expect(tasks.getByRole("button", { name: "„Büro saugen“ erledigen" })).toBeInTheDocument();
    expect(tasks.getByRole("button", { name: "„Haustür putzen“ erledigen" })).toBeInTheDocument();
    expect(await tasks.findByRole("checkbox", { name: "Roboter EG (erledigt)" })).toBeChecked();
    expect(tasks.queryByText("Gestern")).not.toBeInTheDocument();

    const shopping = await region("Für morgen einkaufen");
    expect(await shopping.findByText("Mittag: Eierreis mit Gemüse · Abend: Burger")).toBeInTheDocument();
    expect(await shopping.findByText("1× Milch")).toBeInTheDocument();
    expect(shopping.getByText("2× Spaghetti")).toBeInTheDocument();
    expect(shopping.queryByText("Eier")).not.toBeInTheDocument();
    expect(shopping.queryByText("Reis")).not.toBeInTheDocument();
  });

  it("leaves out reporting, upcoming and creating Aufgaben", async () => {
    mockFetch(routes());
    renderWithProviders(<DashboardPage />);
    await screen.findByRole("heading", { level: 1, name: "Heute" });
    for (const name of [/^Übersicht/, /^Nach Person/, /^Nach Kategorie/, /^Demnächst/, /^Überfällig/, /^Heute fällig/, /^Zuletzt erledigt/]) {
      expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("textbox", { name: "Quick Add" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Minuten offen|überfällig/)).not.toBeInTheDocument();
  });

  it("completes an Aufgabe with its button", async () => {
    let dashboardCalls = 0;
    const fetchMock = mockFetch(
      routes({
        "GET /dashboard": () => (++dashboardCalls === 1 ? ok(dashboard()) : ok(dashboard({ dueToday: [] }))),
        "POST /tenners/t-1/complete": ok(completeResponse()),
      }),
    );
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ erledigen" }));
    await waitFor(() => expect(fetchMock.calls().some((call) => call.key === "POST /tenners/t-1/complete")).toBe(true));
  });

  it("shows empty states for a free day without a plan", async () => {
    mockFetch(
      routes({
        "GET /dashboard": ok(dashboard({ dueToday: [], overdue: [] })),
        "GET /history": ok({ items: [], nextCursor: null }),
        "GET /meals/plans/current": fail(404, "NOT_FOUND"),
        "GET /meals/plans/current/shopping-list": fail(404, "NOT_FOUND"),
      }),
    );
    renderWithProviders(<DashboardPage />);
    expect(await (await region("Heute erledigen wir")).findByText("Heute steht nichts an.")).toBeInTheDocument();
    const shopping = await region("Für morgen einkaufen");
    expect(await shopping.findByText("Keine Einkäufe notwendig")).toBeInTheDocument();
    expect(shopping.queryByText(/Mittag:|Abend:/)).not.toBeInTheDocument();
    expect(await (await region("Heute essen wir")).findByText("Für heute ist noch nichts geplant.")).toBeInTheDocument();
  });

  it("uses next week's list when tomorrow is in the next week", async () => {
    vi.setSystemTime(new Date(2026, 9, 18, 10, 0)); // Sunday
    const fetchMock = mockFetch(
      routes({
        "GET /meals/plans/next/shopping-list": ok({ ...SHOPPING, weekStart: "2026-10-19", items: [item("bread", "Brot", ["2026-10-19#LUNCH"])] }),
        "GET /meals/plans/next": ok(nextWeekPlan({ "2026-10-12#DINNER": null })),
      }),
    );
    renderWithProviders(<DashboardPage />);
    const shopping = await region("Für morgen einkaufen");
    expect(await shopping.findByText("1× Brot")).toBeInTheDocument();
    expect(await shopping.findByText("Mittag: Onigiri")).toBeInTheDocument();
    expect(fetchMock.calls().some((call) => call.key === "GET /meals/plans/next/shopping-list")).toBe(true);
  });

  it("shows an error with retry", async () => {
    let calls = 0;
    mockFetch(routes({ "GET /dashboard": () => (++calls === 1 ? fail(500, "INTERNAL_ERROR") : ok(dashboard())) }));
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("Dashboard konnte nicht geladen werden")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Büro saugen")).toBeInTheDocument();
  });

  it("picks the open items for a date", () => {
    expect(itemsFor(SHOPPING.items, "2026-10-17").map((entry) => entry.key)).toEqual(["pasta", "rice"]);
  });
});
