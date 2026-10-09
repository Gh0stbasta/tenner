import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { INGREDIENTS, dish } from "../../tests/dishFixtures";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DishesPage } from "./DishesPage";

const BOLOGNESE = dish();
const SALAD = dish({
  dishId: "d-2",
  name: "Griechischer Salat",
  group: undefined,
  category: "SALAD",
  slots: ["LUNCH"],
  isVegetarian: true,
  tags: ["MILK"],
  proteinSources: [],
  baseTags: [],
});
const ARCHIVED = dish({ dishId: "d-3", name: "Linsensuppe", group: undefined, category: "SOUP", archived: true });

const list = () => within(screen.getByRole("list", { name: "Gerichte" }));
const names = () =>
  list()
    .getAllByRole("heading")
    .map((heading) => heading.textContent);

function setup(routes = {}) {
  return mockFetch({
    "GET /meals/dishes?archived=false": ok({ dishes: [BOLOGNESE, SALAD] }),
    "GET /meals/dishes?archived=true": ok({ dishes: [ARCHIVED] }),
    "GET /meals/ingredients": ok({ ingredients: INGREDIENTS }),
    ...routes,
  });
}

describe("DishesPage (FOOD-010)", () => {
  it("lists the dishes and filters by search, slot, vegetarian and category", async () => {
    setup();
    renderWithProviders(<DishesPage />);
    expect(await screen.findByRole("heading", { name: "Spaghetti Bolognese" })).toBeInTheDocument();
    expect(screen.getByText("2 Gerichte")).toBeInTheDocument();
    expect(list().getByText("Nudeln · Bolognese")).toBeInTheDocument();
    expect(list().getByText("Mittag, Abend · 20 Min. aktiv (40 Min. gesamt)")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Suchen"), "bolo");
    expect(names()).toEqual(["Spaghetti Bolognese"]);
    await userEvent.clear(screen.getByLabelText("Suchen"));
    await userEvent.click(screen.getByRole("switch", { name: "Vegetarisch" }));
    expect(names()).toEqual(["Griechischer Salat"]);
    await userEvent.click(screen.getByRole("switch", { name: "Vegetarisch" }));
    await userEvent.click(screen.getByRole("button", { name: "Abend" }));
    expect(names()).toEqual(["Spaghetti Bolognese"]);
    await userEvent.click(screen.getByRole("button", { name: "Alle" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Kategorie" }));
    await userEvent.click(await screen.findByRole("option", { name: "Suppe & Eintopf" }));
    expect(screen.getByText("Kein Gericht passt zu den Filtern.")).toBeInTheDocument();
  });

  it("archives with undo and restores from the archive", async () => {
    const fetchMock = setup({
      "DELETE /meals/dishes/d-1": ok({ ...BOLOGNESE, archived: true }),
      "POST /meals/dishes/d-1/restore": ok(BOLOGNESE),
      "POST /meals/dishes/d-3/restore": ok({ ...ARCHIVED, archived: false }),
    });
    renderWithProviders(<DishesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Spaghetti Bolognese archivieren" }));
    expect(
      await screen.findByText("„Spaghetti Bolognese“ archiviert. Es wird nicht mehr geplant."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    await waitFor(() => expect(fetchMock.calls().map((call) => call.key)).toContain("POST /meals/dishes/d-1/restore"));

    await userEvent.click(screen.getByRole("switch", { name: "Archivierte zeigen" }));
    expect(await screen.findByRole("heading", { name: "Linsensuppe" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Linsensuppe bearbeiten" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Linsensuppe wiederherstellen" }));
    expect(await screen.findByText("„Linsensuppe“ wiederhergestellt.")).toBeInTheDocument();
  });

  it("explains a restore that clashes with an active dish name", async () => {
    setup({ "POST /meals/dishes/d-3/restore": fail(409, "DISH_NAME_TAKEN") });
    renderWithProviders(<DishesPage />);
    await userEvent.click(await screen.findByRole("switch", { name: "Archivierte zeigen" }));
    await userEvent.click(await screen.findByRole("button", { name: "Linsensuppe wiederherstellen" }));
    expect(await screen.findByText("Es gibt schon ein aktives Gericht „Linsensuppe“.")).toBeInTheDocument();
  });

  it("opens the editor for a new and an existing dish", async () => {
    setup();
    renderWithProviders(<DishesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Neues Gericht" }));
    expect(screen.getByRole("dialog", { name: "Gericht anlegen" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await userEvent.click(screen.getByRole("button", { name: "Spaghetti Bolognese bearbeiten" }));
    const editor = within(await screen.findByRole("dialog", { name: "Gericht bearbeiten" }));
    expect(editor.getByLabelText(/^Name/)).toHaveValue("Spaghetti Bolognese");
  });

  it("shows empty states and load errors", async () => {
    setup({
      "GET /meals/dishes?archived=false": ok({ dishes: [] }),
      "GET /meals/dishes?archived=true": ok({ dishes: [] }),
    });
    const { unmount } = renderWithProviders(<DishesPage />);
    expect(await screen.findByText(/Noch keine Gerichte\. Legt das erste an/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Archivierte zeigen" }));
    expect(await screen.findByText("Keine archivierten Gerichte.")).toBeInTheDocument();
    unmount();

    setup({ "GET /meals/dishes?archived=false": fail(500, "INTERNAL_ERROR") });
    renderWithProviders(<DishesPage />);
    expect(await screen.findByText("Gerichte konnten nicht geladen werden")).toBeInTheDocument();
  });
});
