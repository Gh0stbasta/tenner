import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CHICKEN, FAMILY, INGREDIENTS, WALNUTS, dish } from "../../tests/dishFixtures";
import { mockFetch, ok, type MockResponse } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DishEditorDialog } from "./DishEditorDialog";

const dialog = () => within(screen.getByRole("dialog", { name: /Gericht/ }));
const meaning = () => within(dialog().getByRole("region", { name: "Was das Gericht bedeutet" }));

function setup(routes: Record<string, MockResponse | (() => MockResponse)> = {}, editing = false) {
  const fetchMock = mockFetch({
    "GET /meals/ingredients": ok({ ingredients: INGREDIENTS }),
    "GET /meals/profile": ok(FAMILY),
    ...routes,
  });
  const onClose = vi.fn();
  renderWithProviders(<DishEditorDialog dish={editing ? dish() : null} groups={["Bolognese"]} onClose={onClose} />);
  return { fetchMock, onClose };
}

async function addIngredient(name: string) {
  await userEvent.type(dialog().getByRole("combobox", { name: "Zutat hinzufügen" }), name.slice(0, 4));
  await userEvent.click(await screen.findByRole("option", { name }));
}

const bodies = (fetchMock: ReturnType<typeof mockFetch>, key: string) =>
  fetchMock
    .calls()
    .filter((call) => call.key === key)
    .map((call) => call.body);

describe("DishEditorDialog (FOOD-010)", () => {
  it("shows validation errors per field and sends nothing", async () => {
    const { fetchMock } = setup();
    await userEvent.click(dialog().getByRole("button", { name: "Gericht anlegen" }));
    expect(dialog().getByText("Bitte mindestens 2 Zeichen.")).toBeInTheDocument();
    expect(dialog().getByText("Bitte mindestens eine Zutat hinzufügen.")).toBeInTheDocument();
    await userEvent.click(dialog().getByRole("checkbox", { name: "Mittag" }));
    await userEvent.click(dialog().getByRole("checkbox", { name: "Abend" }));
    await userEvent.clear(dialog().getByLabelText(/Aktive Kochzeit/));
    await userEvent.click(dialog().getByRole("button", { name: "Gericht anlegen" }));
    expect(dialog().getByText("Bitte Mittag, Abend oder beides wählen.")).toBeInTheDocument();
    expect(dialog().getByText("Ganze Minuten zwischen 1 und 240.")).toBeInTheDocument();
    expect(bodies(fetchMock, "POST /meals/dishes")).toEqual([]);
  });

  it("creates a dish from catalog ingredients and shows what it means for the family", async () => {
    const { fetchMock, onClose } = setup({
      "POST /meals/dishes": ok(dish({ dishId: "d-9", name: "Hähnchen-Pasta" }), 201),
    });
    await userEvent.click(dialog().getByLabelText(/^Name/));
    await userEvent.paste("  Hähnchen-Pasta ");
    await addIngredient("Spaghetti");
    await addIngredient(CHICKEN.name);
    await addIngredient(WALNUTS.name);
    await userEvent.clear(dialog().getByLabelText("Menge Spaghetti"));
    await userEvent.type(dialog().getByLabelText("Menge Spaghetti"), "125");
    const walnutRow = dialog().getByLabelText("Menge Walnüsse").closest("div.MuiStack-root") as HTMLElement;
    await userEvent.click(within(walnutRow).getByRole("switch", { name: "optional" }));

    expect(meaning().getByText("nicht vegetarisch")).toBeInTheDocument();
    expect(meaning().getByText("Protein: Geflügel")).toBeInTheDocument();
    expect(meaning().getByText("Grundzutat: Nudeln")).toBeInTheDocument();
    expect(meaning().getByText("optional: Nüsse")).toBeInTheDocument();
    expect(
      meaning().getByText("Nicht für Erwachsener 2: nicht vegetarisch und keine vegetarische Variante."),
    ).toBeInTheDocument();
    expect(meaning().getByText(/^Hühnchen: nur zu den Mahlzeiten/)).toBeInTheDocument();
    expect(meaning().queryByText(/Allergie/)).not.toBeInTheDocument();

    await userEvent.click(dialog().getByLabelText("Vegetarische Variante (optional)"));
    await userEvent.paste("mit Tofu");
    expect(meaning().queryByText(/nicht vegetarisch und keine/)).not.toBeInTheDocument();
    expect(meaning().getByText("vegetarische Variante")).toBeInTheDocument();

    await userEvent.click(dialog().getByRole("button", { name: "Gericht anlegen" }));
    expect(await screen.findByText("✅ „Hähnchen-Pasta“ angelegt.")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(bodies(fetchMock, "POST /meals/dishes")).toEqual([
      {
        name: "Hähnchen-Pasta",
        category: "PASTA",
        slots: ["LUNCH", "DINNER"],
        lightness: "FILLING",
        temperature: "WARM",
        ingredients: [
          { ingredientId: "i-pasta", quantity: 125, unit: "g", optional: false },
          { ingredientId: "i-chicken", quantity: 100, unit: "g", optional: false },
          { ingredientId: "i-nuts", quantity: 100, unit: "g", optional: true },
        ],
        activeMinutes: 20,
        totalMinutes: 20,
        vegetarianVariant: "mit Tofu",
        familyFriendly: true,
        isBurger: false,
      },
    ]);
  }, 15_000);

  it("creates a new ingredient inline and adds it to the dish", async () => {
    const { fetchMock } = setup({
      "POST /meals/ingredients": ok({ ingredientId: "c-1", name: "Halloumi", unit: "g", tags: ["MILK"] }, 201),
    });
    await userEvent.type(dialog().getByRole("combobox", { name: "Zutat hinzufügen" }), "Halloumi");
    await userEvent.click(await screen.findByRole("option", { name: "Neue Zutat „Halloumi“ anlegen" }));
    const ingredientDialog = within(await screen.findByRole("dialog", { name: "Neue Zutat" }));
    expect(ingredientDialog.getByLabelText(/^Name/)).toHaveValue("Halloumi");
    await userEvent.click(ingredientDialog.getByRole("button", { name: "Milch" }));
    await userEvent.click(ingredientDialog.getByRole("button", { name: "Zutat anlegen" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Neue Zutat" })).not.toBeInTheDocument());
    expect(dialog().getByLabelText("Menge c-1")).toHaveValue(100);
    expect(bodies(fetchMock, "POST /meals/ingredients")).toEqual([
      { name: "Halloumi", unit: "g", tags: ["MILK"], shoppingSection: "SONSTIGES" },
    ]);
  });

  it("asks for the weight of a counted ingredient", async () => {
    setup();
    await userEvent.type(dialog().getByRole("combobox", { name: "Zutat hinzufügen" }), "Wrap");
    await userEvent.click(await screen.findByRole("option", { name: "Neue Zutat „Wrap“ anlegen" }));
    const ingredientDialog = within(await screen.findByRole("dialog", { name: "Neue Zutat" }));
    await userEvent.click(ingredientDialog.getByRole("combobox", { name: "Einheit" }));
    await userEvent.click(await screen.findByRole("option", { name: "Stück" }));
    expect(ingredientDialog.getByText("Gewicht pro Stück in Gramm angeben.")).toBeInTheDocument();
    expect(ingredientDialog.getByRole("button", { name: "Zutat anlegen" })).toBeDisabled();
    await userEvent.type(ingredientDialog.getByLabelText("Gramm pro Stück"), "60");
    expect(ingredientDialog.getByRole("button", { name: "Zutat anlegen" })).toBeEnabled();
  });

  it("edits a dish with PUT, sends removed optional fields as null and removes ingredients", async () => {
    const { fetchMock } = setup({ "PUT /meals/dishes/d-1": ok(dish({ group: undefined })) }, true);
    expect(dialog().getByLabelText(/^Name/)).toHaveValue("Spaghetti Bolognese");
    await userEvent.clear(dialog().getByRole("combobox", { name: "Gruppe (optional)" }));
    await userEvent.click(dialog().getByRole("button", { name: "Hackfleisch entfernen" }));
    expect(meaning().getByText("vegetarisch")).toBeInTheDocument();
    await userEvent.click(dialog().getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("✅ „Spaghetti Bolognese“ gespeichert.")).toBeInTheDocument();
    expect(bodies(fetchMock, "PUT /meals/dishes/d-1")).toEqual([
      expect.objectContaining({
        group: null,
        vegetarianVariant: null,
        ingredients: [{ ingredientId: "i-pasta", quantity: 125, unit: "g", optional: false }],
        totalMinutes: 40,
      }),
    ]);
  });

  it("maps server errors: name taken, field details, concurrent change", async () => {
    let response: MockResponse = {
      status: 409,
      body: { success: false, error: { code: "DISH_NAME_TAKEN", message: "taken" } },
    };
    const { onClose } = setup({ "PUT /meals/dishes/d-1": () => response }, true);
    const saveButton = dialog().getByRole("button", { name: "Speichern" });
    await userEvent.click(saveButton);
    expect(await dialog().findByText("Ein Gericht mit diesem Namen gibt es schon.")).toBeInTheDocument();

    response = {
      status: 400,
      body: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "invalid",
          details: [{ field: "ingredients.0.quantity", message: "Zu viel." }],
        },
      },
    };
    await userEvent.click(saveButton);
    expect(await dialog().findByText("Zu viel.")).toBeInTheDocument();
    expect(dialog().queryByText("Ein Gericht mit diesem Namen gibt es schon.")).not.toBeInTheDocument();

    response = {
      status: 409,
      body: { success: false, error: { code: "CONCURRENT_MODIFICATION", message: "conflict" } },
    };
    await userEvent.click(saveButton);
    expect(
      await dialog().findByText(
        "Das Gericht wurde gerade an einem anderen Gerät geändert. Schließe den Dialog und öffne es neu.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
