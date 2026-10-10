import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EGG, INGREDIENTS, SPAGHETTI } from "../../tests/dishFixtures";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { IngredientPricesDialog } from "./IngredientPricesDialog";

const ingredients = [...INGREDIENTS, { ...SPAGHETTI, ingredientId: "salt", name: "Salz", pantry: true }];

describe("IngredientPricesDialog (FOOD-013)", () => {
  it("lists prices per unit without pantry items and saves a changed price", async () => {
    const fetchMock = mockFetch({
      "GET /meals/ingredients": ok({ ingredients }),
      "PUT /meals/ingredients/i-pasta": ok({ ...SPAGHETTI, pricePerUnit: 0.35 }),
    });
    renderWithProviders(<IngredientPricesDialog onClose={vi.fn()} />);
    const list = within(await screen.findByRole("list", { name: "Zutatenpreise" }));
    expect(await list.findByText("Spaghetti")).toBeInTheDocument();
    expect(list.getAllByText("pro 100 g").length).toBeGreaterThan(0);
    expect(list.queryByText("Salz")).not.toBeInTheDocument();
    expect(list.getByRole("button", { name: "Preis Spaghetti speichern" })).toBeDisabled();
    await userEvent.clear(list.getByLabelText("Preis Spaghetti"));
    await userEvent.type(list.getByLabelText("Preis Spaghetti"), "0,35");
    await userEvent.click(list.getByRole("button", { name: "Preis Spaghetti speichern" }));
    expect(await screen.findByText(/Preis für „Spaghetti“: 0,35\s€ pro 100 g\./)).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "PUT /meals/ingredients/i-pasta")?.body).toEqual({
      pricePerUnit: 0.35,
    });
  });

  it("filters, rejects invalid prices and reports server errors", async () => {
    mockFetch({
      "GET /meals/ingredients": ok({ ingredients }),
      "PUT /meals/ingredients/i-egg": fail(500, "INTERNAL_ERROR"),
    });
    renderWithProviders(<IngredientPricesDialog onClose={vi.fn()} />);
    await screen.findByText("Spaghetti");
    await userEvent.type(screen.getByLabelText("Zutat suchen"), "ei");
    const list = within(screen.getByRole("list", { name: "Zutatenpreise" }));
    await waitFor(() => expect(list.queryByText("Spaghetti")).not.toBeInTheDocument());
    expect(list.getByText(EGG.name)).toBeInTheDocument();
    expect(list.getByText("pro Stück")).toBeInTheDocument();
    await userEvent.clear(list.getByLabelText("Preis Ei"));
    await userEvent.type(list.getByLabelText("Preis Ei"), "abc");
    expect(list.getByText("0 bis 100 €")).toBeInTheDocument();
    expect(list.getByRole("button", { name: "Preis Ei speichern" })).toBeDisabled();
    await userEvent.clear(list.getByLabelText("Preis Ei"));
    await userEvent.type(list.getByLabelText("Preis Ei"), "0,4");
    await userEvent.click(list.getByRole("button", { name: "Preis Ei speichern" }));
    expect(await screen.findByText(/^Preis nicht gespeichert\./)).toBeInTheDocument();
  });
});
