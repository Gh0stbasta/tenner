/** HOUSEHOLD-ADMIN-002: managed categories in the frontend. */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboard, tenner } from "../../tests/fixtures";
import { DEFAULT_CATEGORIES, fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DashboardPage } from "../dashboard/DashboardPage";
import { SettingsPage } from "../settings/SettingsPage";
import { CreateTennerDialog } from "../tenners/CreateTennerDialog";
import { EditTennerDialog } from "../tenners/EditTennerDialog";
import { suggestCategory } from "../tenners/quickAdd";

const GARDEN = { categoryId: "GARDEN", name: "Garten", icon: "GARDEN", color: "GREEN", sortOrder: 6, archived: false };
const archivedFinance = DEFAULT_CATEGORIES.map((c) => (c.categoryId === "FINANCE" ? { ...c, archived: true } : c));

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("categories in pickers", () => {
  it("offers new categories and hides archived ones for new Tenners", async () => {
    mockFetch({ "GET /categories": ok([...archivedFinance, GARDEN]) });
    renderWithProviders(<CreateTennerDialog open onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Kategorie" })).toHaveTextContent("Haushalt"));
    await userEvent.click(screen.getByRole("combobox", { name: "Kategorie" }));
    expect(await screen.findByRole("option", { name: "Garten" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Finanzen/ })).not.toBeInTheDocument();
  });

  it("keeps an archived category on an existing Tenner without offering it anew", async () => {
    mockFetch({ "GET /categories": ok(archivedFinance) });
    renderWithProviders(<EditTennerDialog tenner={tenner({ category: "FINANCE" })} onClose={() => undefined} />);
    const select = screen.getByRole("combobox", { name: "Kategorie" });
    await userEvent.click(select);
    expect(await screen.findByRole("option", { name: "Finance (archiviert)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("suggests only selectable categories in Quick Add", () => {
    expect(suggestCategory("Steuererklärung machen")).toBe("FINANCE");
    expect(suggestCategory("Steuererklärung machen", ["HOUSEHOLD"])).toBeUndefined();
  });

  it("names new categories in the workload summary", async () => {
    mockFetch({
      "GET /categories": ok([...DEFAULT_CATEGORIES, GARDEN]),
      "GET /dashboard": ok(
        dashboard({
          byCategory: { GARDEN: { count: 1, estimatedMinutes: 30 }, PETS: { count: 1, estimatedMinutes: 5 } },
        }),
      ),
    });
    renderWithProviders(<DashboardPage />);
    const card = within(await screen.findByRole("region", { name: "Nach Kategorie" }));
    expect(await card.findByText("Garten")).toBeInTheDocument();
    expect(card.getByText("Pets")).toBeInTheDocument();
  });
});

describe("categories settings", () => {
  function setup(routes: Parameters<typeof mockFetch>[0] = {}) {
    const fetchMock = mockFetch({ "GET /household": ok({ timezone: "Europe/Berlin", vacation: null }), ...routes });
    renderWithProviders(<SettingsPage />);
    return fetchMock;
  }

  it("adds a category with icon and color", async () => {
    const fetchMock = setup({ "POST /categories": ok(GARDEN, 201) });
    await userEvent.click(await screen.findByRole("button", { name: "Kategorie hinzufügen" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Kategorie hinzufügen" }));
    await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), "Garten");
    await userEvent.click(dialog.getByRole("combobox", { name: "Symbol" }));
    await userEvent.click(await screen.findByRole("option", { name: "Garten" }));
    await userEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Kategorie „Garten“ hinzugefügt.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /categories")?.body).toEqual({
      name: "Garten",
      icon: "GARDEN",
      color: "GREEN",
    });
  });

  it("reorders, archives and restores", async () => {
    const fetchMock = setup({
      "PUT /categories/FITNESS": ok({ ...DEFAULT_CATEGORIES[1], sortOrder: 0 }),
      "PUT /categories/FINANCE": ok({ ...DEFAULT_CATEGORIES[5], archived: true }),
    });
    const list = within(await screen.findByRole("list", { name: "Kategorien" }));
    expect(await list.findByRole("button", { name: "Haushalt nach oben" })).toBeDisabled();
    await userEvent.click(list.getByRole("button", { name: "Fitness nach oben" }));
    await waitFor(() =>
      expect(fetchMock.calls().find((call) => call.key === "PUT /categories/FITNESS")?.body).toEqual({ sortOrder: 0 }),
    );
    await userEvent.click(list.getByRole("button", { name: "Finanzen archivieren" }));
    expect(await screen.findByText("„Finanzen“ archiviert.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "PUT /categories/FINANCE")?.body).toEqual({ archived: true });
  });

  it("shows archived categories with a restore action and reports errors", async () => {
    setup({
      "GET /categories": ok(archivedFinance),
      "PUT /categories/FINANCE": fail(409, "CONCURRENT_MODIFICATION", "changed"),
    });
    const list = within(await screen.findByRole("list", { name: "Kategorien" }));
    expect(await list.findByText("Archiviert")).toBeInTheDocument();
    await userEvent.click(list.getByRole("button", { name: "Finanzen wiederherstellen" }));
    expect(await screen.findByText(/^Speichern fehlgeschlagen\./)).toBeInTheDocument();
  });
});
