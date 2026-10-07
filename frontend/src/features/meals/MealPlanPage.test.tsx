import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fail, mockFetch, NOT_READY_PLAN, ok } from "../../tests/fetchMock";
import { mealPlanFixture } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { MealPlanPage } from "./MealPlanPage";
import { TodayMealsCard } from "./TodayMealsCard";

describe("MealPlanPage (FOOD-009)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("asks to set up the family and the dishes first", async () => {
    mockFetch({});
    renderWithProviders(<MealPlanPage />);
    expect(
      await screen.findByText(
        "Der Essensplan entsteht, sobald Tenner wer mitisst (Familienprofil) und eure Gerichte (Gerichtekatalog) kennt.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Einrichten" })).toHaveAttribute("href", "/settings");
  });

  it("shows the week with today first, details, empty meals and hints", async () => {
    const plan = mealPlanFixture({
      dishes: { "2026-10-16#LUNCH": null },
      violations: [
        {
          rule: "R10",
          severity: "SOFT",
          slotIds: ["2026-10-14#DINNER"],
          message: "Mittwoch abends lieber warm und sättigend.",
        },
      ],
    });
    mockFetch({ "GET /meals/plans/current": ok(plan) });
    renderWithProviders(<MealPlanPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Essen" })).toBeInTheDocument();
    const days = screen.getAllByRole("region");
    expect(days).toHaveLength(7);
    const today = within(screen.getByRole("region", { name: "Mittwoch, 14. Oktober" }));
    expect(today.getByRole("heading", { name: /^Heute/ })).toBeInTheDocument();
    expect(today.getByRole("group", { name: "Mittag: Linseneintopf" })).toBeInTheDocument();
    expect(today.getByText("Mittwoch abends lieber warm und sättigend.")).toBeInTheDocument();
    const thursday = within(screen.getByRole("region", { name: "Donnerstag, 15. Oktober" }));
    expect(thursday.getByText("15 Min. aktiv · vegetarisch: mit Gemüse-Patty")).toBeInTheDocument();
    const friday = within(screen.getByRole("region", { name: "Freitag, 16. Oktober" }));
    expect(friday.getByText("Nichts geplant")).toBeInTheDocument();
    expect(friday.getByText("Kein Gericht passt (meist: mittags leicht).")).toBeInTheDocument();
  });

  it("switches to next week", async () => {
    const fetchMock = mockFetch({
      "GET /meals/plans/current": ok(mealPlanFixture()),
      "GET /meals/plans/next": ok({ ...NOT_READY_PLAN, weekStart: "2026-10-19", weekEnd: "2026-10-25" }),
    });
    renderWithProviders(<MealPlanPage />);
    await screen.findByRole("region", { name: "Montag, 12. Oktober" });
    await userEvent.click(screen.getByRole("button", { name: "Nächste Woche" }));
    expect(await screen.findByText(/Der Essensplan entsteht/)).toBeInTheDocument();
    expect(fetchMock.calls().some((call) => call.key === "GET /meals/plans/next")).toBe(true);
  });

  it("shows errors with a retry", async () => {
    mockFetch({ "GET /meals/plans/current": fail(500, "INTERNAL_ERROR") });
    renderWithProviders(<MealPlanPage />);
    expect(await screen.findByText("Essensplan konnte nicht geladen werden")).toBeInTheDocument();
  });
});

describe("TodayMealsCard (FOOD-009)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("shows today's meals and links to the plan", async () => {
    mockFetch({ "GET /meals/plans/current": ok(mealPlanFixture()) });
    renderWithProviders(<TodayMealsCard />);
    const card = within(await screen.findByRole("region", { name: "Heute essen wir" }));
    expect(card.getByText("Mittag: Linseneintopf")).toBeInTheDocument();
    expect(card.getByText("Abend: Käsespätzle mit Röstzwiebeln")).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Zum Essensplan" })).toHaveAttribute("href", "/essen");
  });

  it("stays hidden while there is no plan", async () => {
    const fetchMock = mockFetch({});
    renderWithProviders(<TodayMealsCard />);
    await vi.waitFor(() =>
      expect(fetchMock.calls().some((call) => call.key === "GET /meals/plans/current")).toBe(true),
    );
    expect(screen.queryByRole("region", { name: "Heute essen wir" })).not.toBeInTheDocument();
  });
});
