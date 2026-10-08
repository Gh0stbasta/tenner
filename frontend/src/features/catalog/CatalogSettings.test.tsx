import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { CatalogSettings } from "./CatalogSettings";

const preview = {
  dryRun: true,
  membersCreated: ["Haushaltshilfe"],
  tennersCreated: ["Kleines Bad", "Spiegel putzen"],
  tennersSkipped: ["Müll rausbringen"],
};

function section() {
  return within(screen.getByRole("region", { name: "Aufgabenkatalog" }));
}

describe("CatalogSettings (DATA-008)", () => {
  it("previews with a dry run, then imports after the confirmation", async () => {
    const fetchMock = mockFetch({
      "POST /household/catalog": ({ init }) =>
        JSON.parse(String(init?.body)).dryRun ? ok(preview) : ok({ ...preview, dryRun: false }),
    });
    renderWithProviders(<CatalogSettings />);
    await userEvent.click(section().getByRole("button", { name: "Katalog prüfen" }));
    expect(
      await section().findByText("2 neue Aufgaben · Mitglied Haushaltshilfe (ohne Anmeldung) · 1 schon vorhanden"),
    ).toBeInTheDocument();
    await userEvent.click(section().getByRole("button", { name: "Jetzt importieren" }));
    expect(await screen.findByText("Aufgabenkatalog importiert: 2 Aufgaben angelegt.")).toBeInTheDocument();
    expect(
      fetchMock
        .calls()
        .filter((call) => call.key === "POST /household/catalog")
        .map((call) => call.body),
    ).toEqual([{ dryRun: true }, { dryRun: false }]);
    expect(section().getByRole("button", { name: "Katalog prüfen" })).toBeInTheDocument();
  });

  it("says when everything exists, and cancel returns to the start", async () => {
    let calls = 0;
    mockFetch({
      "POST /household/catalog": () =>
        ++calls === 1 ? ok(preview) : ok({ ...preview, membersCreated: [], tennersCreated: [] }),
    });
    renderWithProviders(<CatalogSettings />);
    await userEvent.click(section().getByRole("button", { name: "Katalog prüfen" }));
    await userEvent.click(await section().findByRole("button", { name: "Abbrechen" }));
    await userEvent.click(section().getByRole("button", { name: "Katalog prüfen" }));
    expect(await section().findByText("Alles aus dem Katalog ist schon angelegt.")).toBeInTheDocument();
  });

  it("shows server errors", async () => {
    mockFetch({ "POST /household/catalog": fail(409, "CATALOG_MEMBERS_MISSING", "missing") });
    renderWithProviders(<CatalogSettings />);
    await userEvent.click(section().getByRole("button", { name: "Katalog prüfen" }));
    expect(
      await section().findByText("Der Aufgabenkatalog braucht die Mitglieder Stefan und Julia (IDs STEFAN, JULIA)."),
    ).toBeInTheDocument();
  });
});
