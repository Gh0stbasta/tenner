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

  it("replaces a meal, cycles through alternatives and undoes (FOOD-007)", async () => {
    const plan = mealPlanFixture();
    const withDish = (name: string, dishId: string) => ({
      ...plan,
      slots: plan.slots.map((slot) =>
        slot.slotId === "2026-10-14#DINNER"
          ? { ...slot, dishId, dish: { ...(slot.dish as object), dishId, name } }
          : slot,
      ),
    });
    let calls = 0;
    const fetchMock = mockFetch({
      "GET /meals/plans/current": ok(plan),
      "POST /meals/plans/current/slots/2026-10-14%23DINNER/replace": ({ init }) => {
        const body = JSON.parse(String(init?.body)) as { dishId?: string };
        if (body.dishId) return ok(plan);
        calls += 1;
        return ok(calls === 1 ? withDish("Ramen", "dish-ramen") : withDish("Chili", "dish-chili"));
      },
    });
    renderWithProviders(<MealPlanPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Aktionen: Mi., 14. Okt. Abend" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Anderes Gericht" }));
    expect(
      await screen.findByText("Mi., 14. Okt. Abend: Ramen statt Käsespätzle mit Röstzwiebeln."),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Mittwoch, 14. Oktober" })).getByRole("group", {
        name: "Abend: Ramen",
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aktionen: Mi., 14. Okt. Abend" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Anderes Gericht" }));
    expect(await screen.findByText("Mi., 14. Okt. Abend: Chili statt Ramen.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(
      await within(screen.getByRole("region", { name: "Mittwoch, 14. Oktober" })).findByRole("group", {
        name: "Abend: Käsespätzle mit Röstzwiebeln",
      }),
    ).toBeInTheDocument();
    const bodies = fetchMock
      .calls()
      .filter((call) => call.key.startsWith("POST /meals/plans/current/slots"))
      .map((call) => call.body);
    expect(bodies).toEqual([
      { excludeDishIds: ["dish-5"] },
      { excludeDishIds: ["dish-5", "dish-ramen"] },
      { dishId: "dish-ramen" },
    ]);
  });

  it("disables actions for past meals and shows replace errors", async () => {
    mockFetch({
      "GET /meals/plans/current": ok(mealPlanFixture()),
      "POST /meals/plans/current/slots/2026-10-14%23LUNCH/replace": fail(409, "NO_ALTERNATIVE"),
    });
    renderWithProviders(<MealPlanPage />);
    expect(await screen.findByRole("button", { name: "Aktionen: Mo., 12. Okt. Mittag" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Aktionen: Mi., 14. Okt. Mittag" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Anderes Gericht" }));
    expect(await screen.findByText("Kein anderes Gericht passt in diese Woche.")).toBeInTheDocument();
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
