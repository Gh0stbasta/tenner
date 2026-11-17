/** MAINT-022: the „Tafel“ — full-screen overview for the Echo Show browser. */

import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dashboard, dashboardTenner, mealPlanFixture } from "../../tests/fixtures";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { TafelPage } from "./TafelPage";
import { daysOf, openShopping, readTafelView, TAFEL_REFRESH_MS, TAFEL_VIEW_KEY, writeTafelView } from "./tafel";

const item = (key: string, name: string, extra: Record<string, unknown> = {}) => ({
  key,
  ingredientId: key,
  name,
  quantity: 1,
  unit: "Stück",
  section: "TROCKENWAREN",
  pantry: false,
  checked: false,
  manual: false,
  usedFor: [],
  ...extra,
});
const SHOPPING = {
  weekStart: "2026-10-12",
  range: "REST",
  generatedAt: "2026-10-12T05:00:00Z",
  stale: false,
  items: [item("milk", "Milch"), item("pasta", "Nudeln", { quantity: 2 }), item("eggs", "Eier", { checked: true })],
};

function routes(extra = {}) {
  return mockFetch({
    "GET /meals/plans/current": ok(mealPlanFixture()),
    "GET /dashboard": ok(dashboard({ overdue: [dashboardTenner({ tennerId: "t-9", title: "Fenster putzen" })] })),
    "GET /meals/plans/current/shopping-list": ok(SHOPPING),
    ...extra,
  });
}

describe("Tafel helpers (MAINT-022)", () => {
  it("remembers the view and falls back to „Heute“", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    expect(readTafelView(storage)).toBe("DAY");
    writeTafelView(storage, "WEEK");
    expect(store.get(TAFEL_VIEW_KEY)).toBe("WEEK");
    expect(readTafelView(storage)).toBe("WEEK");
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readTafelView(broken)).toBe("DAY");
    expect(() => writeTafelView(broken, "WEEK")).not.toThrow();
  });

  it("orders the days and limits the shopping list", () => {
    const days = daysOf(mealPlanFixture() as never);
    expect(days.map((day) => day.date)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(days[2]?.lunch?.dish?.name).toBe("Linseneintopf");
    expect(daysOf(undefined)).toEqual([]);
    const many = Array.from({ length: 20 }, (_, index) => item(`i${index}`, `Ding ${index}`));
    expect(openShopping(many as never)).toMatchObject({ more: 5 });
    expect(openShopping(many as never).shown).toHaveLength(15);
  });
});

describe("TafelPage (MAINT-022)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0));
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("shows today's meals, the open Aufgaben and the shopping list full screen", async () => {
    routes();
    renderWithProviders(<TafelPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Mittwoch, 14. Oktober" })).toBeInTheDocument();
    expect(screen.getByLabelText("Uhrzeit")).toHaveTextContent("10:00");
    const meals = within(screen.getByRole("region", { name: "Heute essen wir" }));
    expect(await meals.findByText("Linseneintopf")).toBeInTheDocument();
    expect(meals.getByText("Käsespätzle mit Röstzwiebeln")).toBeInTheDocument();
    const tasks = within(screen.getByRole("region", { name: "Heute erledigen wir" }));
    expect(await tasks.findByText("Fenster putzen")).toBeInTheDocument();
    expect(tasks.getByText("Büro saugen")).toBeInTheDocument();
    const shopping = within(screen.getByRole("region", { name: "Einkaufsliste" }));
    expect(await shopping.findByText("1× Milch")).toBeInTheDocument();
    expect(shopping.getByText("2× Nudeln")).toBeInTheDocument();
    expect(shopping.queryByText(/Eier/)).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("switches to the week, remembers it and highlights today", async () => {
    routes();
    renderWithProviders(<TafelPage />);
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: "Woche" }));
    const week = within(await screen.findByRole("region", { name: "Diese Woche" }));
    expect(await week.findByText("Onigiri")).toBeInTheDocument();
    expect(week.getByText("Flammkuchen")).toBeInTheDocument();
    expect(week.getByLabelText("Mi., 14.")).toHaveAttribute("aria-current", "date");
    expect(window.localStorage.getItem(TAFEL_VIEW_KEY)).toBe("WEEK");
  });

  it("shows empty states and reloads every few minutes", async () => {
    const fetchMock = routes({
      "GET /meals/plans/current": fail(404, "NOT_FOUND"),
      "GET /dashboard": ok(dashboard({ dueToday: [], overdue: [] })),
      "GET /meals/plans/current/shopping-list": ok({ ...SHOPPING, items: [] }),
    });
    renderWithProviders(<TafelPage />);
    expect(await screen.findByText("Der Essensplan konnte nicht geladen werden.")).toBeInTheDocument();
    expect(await screen.findByText("Heute steht nichts an.")).toBeInTheDocument();
    expect(await screen.findByText("Nichts einzukaufen.")).toBeInTheDocument();
    const before = fetchMock.calls().filter((call) => call.key === "GET /dashboard").length;
    await act(async () => {
      vi.advanceTimersByTime(TAFEL_REFRESH_MS);
    });
    await vi.waitFor(() =>
      expect(fetchMock.calls().filter((call) => call.key === "GET /dashboard").length).toBeGreaterThan(before),
    );
  });
});
