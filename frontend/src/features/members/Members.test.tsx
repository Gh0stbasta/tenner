/** HOUSEHOLD-ADMIN-001: managed household members in the frontend. */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboard } from "../../tests/fixtures";
import { DEFAULT_MEMBERS, fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DashboardPage } from "../dashboard/DashboardPage";
import { SettingsPage } from "../settings/SettingsPage";
import { CreateTennerDialog } from "../tenners/CreateTennerDialog";
import { fallbackName } from "./api";

const LENA = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true };

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("member names", () => {
  it("derives a readable fallback from the ID", () => {
    expect(fallbackName("STEFAN")).toBe("Stefan");
    expect(fallbackName("LENA_MARIE")).toBe("Lena Marie");
  });
});

describe("members in pickers and summaries", () => {
  it("offers stored members as assignees", async () => {
    const fetchMock = mockFetch({
      "GET /users": ok([...DEFAULT_MEMBERS, LENA]),
      "POST /tenners": ok({}, 201),
    });
    renderWithProviders(<CreateTennerDialog open onClose={() => undefined} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Zuständig" }));
    expect(await screen.findByRole("option", { name: "Lena" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Lena" }));
    expect(screen.getByRole("combobox", { name: "Zuständig" })).toHaveTextContent("Lena");
    expect(fetchMock.calls().some((call) => call.key === "GET /users")).toBe(true);
  });

  it("names new members in the workload summary", async () => {
    mockFetch({
      "GET /users": ok([...DEFAULT_MEMBERS, LENA]),
      "GET /dashboard": ok(
        dashboard({ byUser: { LENA: { count: 2, estimatedMinutes: 20 }, KIM: { count: 1, estimatedMinutes: 5 } } }),
      ),
    });
    renderWithProviders(<DashboardPage />);
    const card = within(await screen.findByRole("region", { name: "Nach Person" }));
    expect(await card.findByText("Lena")).toBeInTheDocument();
    expect(card.getByText("Kim")).toBeInTheDocument();
  });
});

describe("members settings", () => {
  function setup(routes: Parameters<typeof mockFetch>[0] = {}) {
    const fetchMock = mockFetch({ "GET /household": ok({ timezone: "Europe/Berlin", vacation: null }), ...routes });
    renderWithProviders(<SettingsPage />);
    return fetchMock;
  }

  it("lists the members with their IDs", async () => {
    setup();
    const list = within(await screen.findByRole("list", { name: "Mitglieder" }));
    expect(await list.findByText("Stefan")).toBeInTheDocument();
    expect(list.getByText("JULIA")).toBeInTheDocument();
  });

  it("adds a member with name and color", async () => {
    const fetchMock = setup({ "POST /users": ok(LENA, 201) });
    await userEvent.click(await screen.findByRole("button", { name: "Mitglied hinzufügen" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Mitglied hinzufügen" }));
    await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), " Lena ");
    await userEvent.click(dialog.getByRole("combobox", { name: "Farbe" }));
    await userEvent.click(await screen.findByRole("option", { name: "Grün" }));
    await userEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("„Lena“ hinzugefügt.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /users")?.body).toEqual({
      displayName: "Lena",
      color: "GREEN",
    });
  });

  it("renames a member and keeps the ID", async () => {
    const fetchMock = setup({ "PUT /users/STEFAN": ok({ ...DEFAULT_MEMBERS[0], displayName: "Steffen" }) });
    await userEvent.click(await screen.findByRole("button", { name: "Stefan bearbeiten" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Mitglied bearbeiten" }));
    expect(dialog.getByText("ID: STEFAN (unveränderlich)")).toBeInTheDocument();
    const name = dialog.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Steffen");
    await userEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("„Steffen“ gespeichert.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "PUT /users/STEFAN")?.body).toEqual({
      displayName: "Steffen",
      color: "BLUE",
    });
  });

  it("validates the name and shows server errors", async () => {
    setup({ "POST /users": fail(409, "MEMBER_EXISTS", "Member STEFAN already exists.") });
    await userEvent.click(await screen.findByRole("button", { name: "Mitglied hinzufügen" }));
    const dialog = within(await screen.findByRole("dialog"));
    const save = dialog.getByRole("button", { name: "Speichern" });
    expect(save).toBeDisabled();
    await userEvent.click(dialog.getByRole("textbox", { name: "Name" }));
    await userEvent.paste("x".repeat(41));
    expect(dialog.getByText("Höchstens 40 Zeichen.")).toBeInTheDocument();
    expect(save).toBeDisabled();
    await userEvent.clear(dialog.getByRole("textbox", { name: "Name" }));
    await userEvent.type(dialog.getByRole("textbox", { name: "Name" }), "Stefan");
    await userEvent.click(save);
    expect(await dialog.findByText(/^Speichern fehlgeschlagen\./)).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
