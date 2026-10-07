import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { MealCatalogSettings } from "./MealCatalogSettings";

const preview = { dryRun: true, dishesCreated: ["Onigiri", "Lasagne"], dishesSkipped: ["Ramen"] };
const section = () => within(screen.getByRole("region", { name: "Essen: Gerichtekatalog" }));

describe("MealCatalogSettings (FOOD-003)", () => {
  it("previews with a dry run, then imports after the confirmation", async () => {
    const fetchMock = mockFetch({
      "POST /meals/catalog": ({ init }) =>
        JSON.parse(String(init?.body)).dryRun ? ok(preview) : ok({ ...preview, dryRun: false }),
    });
    renderWithProviders(<MealCatalogSettings />);
    await userEvent.click(section().getByRole("button", { name: "Katalog prüfen" }));
    expect(await section().findByText("2 neue Gerichte · 1 schon vorhanden")).toBeInTheDocument();
    await userEvent.click(section().getByRole("button", { name: "Jetzt importieren" }));
    expect(await screen.findByText("Gerichtekatalog importiert: 2 Gerichte angelegt.")).toBeInTheDocument();
    expect(
      fetchMock
        .calls()
        .filter((call) => call.key === "POST /meals/catalog")
        .map((call) => call.body),
    ).toEqual([{ dryRun: true }, { dryRun: false }]);
  });

  it("says when everything exists, and cancel returns to the start", async () => {
    let calls = 0;
    mockFetch({ "POST /meals/catalog": () => (++calls === 1 ? ok(preview) : ok({ ...preview, dishesCreated: [] })) });
    renderWithProviders(<MealCatalogSettings />);
    await userEvent.click(section().getByRole("button", { name: "Katalog prüfen" }));
    await userEvent.click(await section().findByRole("button", { name: "Abbrechen" }));
    await userEvent.click(section().getByRole("button", { name: "Katalog prüfen" }));
    expect(await section().findByText("Alle Gerichte aus dem Katalog sind schon angelegt.")).toBeInTheDocument();
  });

  it("shows server errors", async () => {
    mockFetch({ "POST /meals/catalog": fail(503, "SERVICE_UNAVAILABLE") });
    renderWithProviders(<MealCatalogSettings />);
    await userEvent.click(section().getByRole("button", { name: "Katalog prüfen" }));
    expect(
      await section().findByText("Tenner ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal."),
    ).toBeInTheDocument();
  });
});
