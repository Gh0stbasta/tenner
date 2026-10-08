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
        "Der Essensplan entsteht, sobald die Zentrale wer mitisst (Familienprofil) und eure Gerichte (Gerichtekatalog) kennt.",
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

  const withSlot = (plan: ReturnType<typeof mealPlanFixture>, slotId: string, change: Record<string, unknown>) => ({
    ...plan,
    slots: plan.slots.map((slot) => (slot.slotId === slotId ? { ...slot, ...change } : slot)),
  });
  const dish = (dishId: string, name: string) => ({
    dishId,
    name,
    category: "SWEET",
    lightness: "FILLING",
    temperature: "WARM",
    activeMinutes: 15,
    totalMinutes: 20,
    isVegetarian: true,
    favorite: false,
    archived: false,
  });

  it("chooses a dish by hand: fitting dishes first, harmful ones only after a confirmation (FOOD-022)", async () => {
    const plan = mealPlanFixture();
    const options = [
      { dish: dish("dish-ramen", "Ramen"), violations: [] },
      {
        dish: dish("dish-apple", "Apfelpfannkuchen"),
        violations: [
          { rule: "R1", severity: "HARD", slotIds: ["2026-10-14#DINNER"], message: "Kind 1 verträgt Apfel nicht." },
        ],
      },
    ];
    let confirmed = false;
    const fetchMock = mockFetch({
      "GET /meals/plans/current": ok(plan),
      "GET /meals/plans/current/slots/2026-10-14%23DINNER/options": ok({ options }),
      "PUT /meals/plans/current/slots/2026-10-14%23DINNER": ({ init }) => {
        const body = JSON.parse(String(init?.body)) as { dishId?: string; confirm?: boolean };
        if (body.dishId === "dish-apple" && !body.confirm)
          return fail(409, "CONFIRMATION_REQUIRED", "Kind 1 verträgt Apfel nicht.");
        confirmed = body.confirm === true;
        return ok(
          withSlot(plan, "2026-10-14#DINNER", {
            dishId: body.dishId,
            locked: true,
            source: "MANUAL",
            dish: dish(String(body.dishId), "Apfelpfannkuchen"),
          }),
        );
      },
    });
    renderWithProviders(<MealPlanPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Aktionen: Mi., 14. Okt. Abend" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Selbst wählen" }));
    const picker = within(await screen.findByRole("dialog", { name: "Gericht wählen: Mi., 14. Okt. Abend" }));
    const items = await picker.findAllByRole("button", { name: /Ramen|Apfelpfannkuchen/ });
    expect(items.map((item) => item.textContent)).toEqual([
      "RamenPasst zu allen Regeln",
      "ApfelpfannkuchenKind 1 verträgt Apfel nicht.",
    ]);
    await userEvent.type(picker.getByLabelText("Suchen"), "apfel");
    expect(picker.queryByText("Ramen")).not.toBeInTheDocument();
    await userEvent.click(picker.getByRole("button", { name: /Apfelpfannkuchen/ }));
    const confirm = within(await screen.findByRole("dialog", { name: "Wirklich?" }));
    expect(confirm.getByText("Kind 1 verträgt Apfel nicht.")).toBeInTheDocument();
    await userEvent.click(confirm.getByRole("button", { name: "Trotzdem wählen" }));
    expect(await screen.findByText("Mi., 14. Okt. Abend: Apfelpfannkuchen festgelegt.")).toBeInTheDocument();
    expect(confirmed).toBe(true);
    expect(await screen.findByRole("group", { name: "Abend: Apfelpfannkuchen" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    await vi.waitFor(() =>
      expect(
        fetchMock
          .calls()
          .filter((call) => call.key.startsWith("PUT"))
          .at(-1)?.body,
      ).toEqual({
        dishId: "dish-5",
        locked: false,
        confirm: true,
      }),
    );
  });

  it("swaps two meals and locks a meal (FOOD-022)", async () => {
    const plan = mealPlanFixture();
    const fetchMock = mockFetch({
      "GET /meals/plans/current": ok(plan),
      "POST /meals/plans/current/swap": ok(plan),
      "PUT /meals/plans/current/slots/2026-10-15%23DINNER": ok(withSlot(plan, "2026-10-15#DINNER", { locked: true })),
    });
    renderWithProviders(<MealPlanPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Aktionen: Mi., 14. Okt. Abend" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Tauschen" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Käsespätzle mit Röstzwiebeln tauschen mit …" }));
    expect(dialog.queryByRole("button", { name: /Di., 13. Okt./ })).not.toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: /Mi., 14. Okt. Abend/ })).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: /Fr., 16. Okt. Abend/ }));
    expect(await screen.findByText("Mi., 14. Okt. Abend und Fr., 16. Okt. Abend getauscht.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /meals/plans/current/swap")?.body).toEqual({
      from: "2026-10-14#DINNER",
      to: "2026-10-16#DINNER",
    });

    await userEvent.click(await screen.findByRole("button", { name: "Aktionen: Do., 15. Okt. Abend" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Festlegen" }));
    expect(await screen.findByText("Do., 15. Okt. Abend: festgelegt, bleibt beim Neuplanen.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key.startsWith("PUT"))?.body).toEqual({ locked: true });
    expect(screen.getAllByLabelText("Festgelegt")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Aktionen: Do., 15. Okt. Abend" }));
    expect(screen.getByRole("menuitem", { name: "Festlegung lösen" })).toBeInTheDocument();
  });

  it("regenerates the week after a confirmation and undoes it (FOOD-008)", async () => {
    const plan = withSlot(mealPlanFixture(), "2026-10-16#DINNER", { locked: true });
    const replanned = withSlot(plan, "2026-10-17#LUNCH", { dishId: "dish-new", dish: dish("dish-new", "Ramen") });
    let calls = 0;
    const fetchMock = mockFetch({
      "GET /meals/plans/current": ok(plan),
      "POST /meals/plans/current/regenerate": () => {
        calls += 1;
        return ok({ ...(calls === 1 ? replanned : plan), regeneration: { changed: 1, kept: 5 } });
      },
    });
    renderWithProviders(<MealPlanPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Woche neu planen" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Woche neu planen?" }));
    expect(
      dialog.getByText(
        "9 Mahlzeiten werden neu geplant. Bleiben: Fr., 16. Okt. Abend (Fischstäbchen mit Erbsenpüree). Vergangene, festgelegte und selbst gewählte Mahlzeiten bleiben, wie sie sind.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Neu planen" }));
    expect(await screen.findByText("Woche neu geplant: 1 Mahlzeit geändert.")).toBeInTheDocument();
    expect(await screen.findByRole("group", { name: "Mittag: Ramen" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(await screen.findByRole("group", { name: "Mittag: Kaiserschmarrn" })).toBeInTheDocument();
    expect(
      fetchMock
        .calls()
        .filter((call) => call.key.endsWith("/regenerate"))
        .map((call) => call.body),
    ).toEqual([{}, { restore: [{ slotId: "2026-10-17#LUNCH", dishId: "dish-10" }] }]);
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
    expect(await card.findByText("Linseneintopf")).toBeInTheDocument();
    expect(card.getByText("Mittag")).toBeInTheDocument();
    expect(card.getByText("Käsespätzle mit Röstzwiebeln")).toBeInTheDocument();
    expect(card.getByText("Abend")).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Zum Essensplan" })).toHaveAttribute("href", "/essen");
  });

  it("says so while there is no plan (UI-001: the card is always the dashboard's main element)", async () => {
    mockFetch({});
    renderWithProviders(<TodayMealsCard />);
    const card = within(screen.getByRole("region", { name: "Heute essen wir" }));
    expect(await card.findByText("Für heute ist noch nichts geplant.")).toBeInTheDocument();
  });
});
