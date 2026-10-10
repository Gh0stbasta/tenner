import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { AnalyticsPage } from "./AnalyticsPage";

const DATA = {
  period: "4w",
  from: "2026-09-17",
  to: "2026-10-14",
  meals: 5,
  protein: [
    { tag: "NONE", count: 3 },
    { tag: "POULTRY", count: 2 },
  ],
  vegetarianShare: 0.6,
  favorites: [
    { dishId: "a", name: "Pasta", count: 3, feedback: "UP" },
    { dishId: "b", name: "Hähnchen", count: 2, feedback: null },
  ],
  rarelyEaten: [{ dishId: "c", name: "Suppe" }],
  cost: {
    total: 42.5,
    perMeal: 8.5,
    weeks: [
      { weekStart: "2026-10-05", total: 28 },
      { weekStart: "2026-10-12", total: 14.5 },
    ],
  },
  variety: { distinctDishes: 3, meals: 5, repeats: [] },
  adherence: { asPlanned: 3, replaced: 1, skipped: 1, other: 1 },
};

async function openFood() {
  renderWithProviders(<AnalyticsPage />, { route: "/analytics" });
  await userEvent.click(screen.getByRole("tab", { name: "Essen" }));
  return within(await screen.findByRole("region", { name: "Essen" }));
}

describe("Food analytics (FOOD-019)", () => {
  it("shows the tiles, charts and lists for the period", async () => {
    const fetchMock = mockFetch({
      "GET /meals/analytics?period=4w": ok(DATA),
      "GET /meals/analytics?period=1y": ok({ ...DATA, period: "1y", meals: 120 }),
    });
    const food = await openFood();
    const tiles = within(await food.findByRole("region", { name: "Kennzahlen Essen" }));
    expect(await tiles.findByText("60 %")).toBeInTheDocument();
    expect(tiles.getByText("3 Gerichte")).toBeInTheDocument();
    expect(tiles.getByText(/42,50\s€/)).toBeInTheDocument();
    expect(food.getByText("ohne Fleisch/Fisch")).toBeInTheDocument();
    expect(food.getByText("Geflügel")).toBeInTheDocument();
    expect(food.getByText("3× 👍")).toBeInTheDocument();
    expect(food.getByRole("img", { name: "Kosten pro Woche" })).toBeInTheDocument();
    expect(food.getByText("wie geplant: 3")).toBeInTheDocument();
    expect(food.getByText("Suppe")).toBeInTheDocument();
    await userEvent.click(food.getByRole("button", { name: "Plan eingehalten als Tabelle zeigen" }));
    expect(food.getByRole("table", { name: "Plan eingehalten" })).toBeInTheDocument();
    await userEvent.click(food.getByRole("button", { name: "1 Jahr" }));
    expect(await tiles.findByText("120")).toBeInTheDocument();
    expect(fetchMock.calls().map((call) => call.key)).toContain("GET /meals/analytics?period=1y");
  });

  it("explains an empty history", async () => {
    mockFetch({
      "GET /meals/analytics?period=4w": ok({ ...DATA, meals: 0, favorites: [], protein: [], vegetarianShare: null }),
    });
    const food = await openFood();
    expect(await food.findByText(/noch keine gegessenen Mahlzeiten/)).toBeInTheDocument();
  });
});
