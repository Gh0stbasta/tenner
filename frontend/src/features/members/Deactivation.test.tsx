/** HOUSEHOLD-ADMIN-004: deactivate and reactivate members in the settings. */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenner } from "../../tests/fixtures";
import { DEFAULT_MEMBERS, fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { SettingsPage } from "../settings/SettingsPage";

const LENA = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true, canSignIn: true };

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

function setup(routes: Parameters<typeof mockFetch>[0] = {}) {
  const fetchMock = mockFetch({
    "GET /household": ok({ timezone: "Europe/Berlin" }),
    "GET /users": ok([...DEFAULT_MEMBERS, LENA]),
    "GET /tenners?assignedTo=LENA": ok([
      tenner({ tennerId: "a", assignedTo: "LENA" }),
      tenner({ tennerId: "b", assignedTo: "LENA" }),
    ]),
    "GET /tenners?assignedTo=LENA&active=false": ok([tenner({ tennerId: "c", assignedTo: "LENA", active: false })]),
    ...routes,
  });
  renderWithProviders(<SettingsPage />, { user: "STEFAN" });
  return fetchMock;
}

const members = async () => within(await screen.findByRole("list", { name: "Mitglieder" }));

describe("member deactivation", () => {
  it("deactivates with reassignment and shows a summary", async () => {
    const fetchMock = setup({
      "POST /users/LENA/deactivate": ok({
        member: { ...LENA, active: false },
        reassigned: 3,
        reassignedTo: "JULIA",
        revokedAccounts: 1,
      }),
    });
    await userEvent.click(await (await members()).findByRole("button", { name: "Lena deaktivieren" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Lena deaktivieren?" }));
    const target = await dialog.findByRole("combobox", { name: "3 Aufgaben übertragen an" });
    expect(target).toHaveTextContent("Stefan");
    await userEvent.click(target);
    await userEvent.click(await screen.findByRole("option", { name: "Julia" }));
    await userEvent.click(dialog.getByRole("button", { name: "Deaktivieren" }));
    expect(await screen.findByText("Lena deaktiviert. 3 Aufgaben an Julia übertragen.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /users/LENA/deactivate")?.body).toEqual({
      reassignTo: "JULIA",
    });
  });

  it("needs no target when nothing is assigned and shows server errors", async () => {
    const fetchMock = setup({
      "GET /tenners?assignedTo=LENA": ok([]),
      "GET /tenners?assignedTo=LENA&active=false": ok([]),
      "POST /users/LENA/deactivate": fail(409, "LAST_ACTIVE_MEMBER", "The last active member cannot be deactivated."),
    });
    await userEvent.click(await (await members()).findByRole("button", { name: "Lena deaktivieren" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText("Es sind keine Aufgaben zugeordnet.")).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Deaktivieren" }));
    expect(await dialog.findByText(/^Deaktivieren fehlgeschlagen\./)).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /users/LENA/deactivate")?.body).toEqual({});
  });

  it("offers no deactivation for yourself or the last active member", async () => {
    setup({ "GET /users": ok([DEFAULT_MEMBERS[0], { ...DEFAULT_MEMBERS[1], active: false }]) });
    const list = await members();
    expect(await list.findByText("Stefan")).toBeInTheDocument();
    expect(list.queryByRole("button", { name: "Stefan deaktivieren" })).not.toBeInTheDocument();
    expect(list.getByText("JULIA · Deaktiviert")).toBeInTheDocument();
  });

  it("reactivates a deactivated member", async () => {
    const fetchMock = setup({
      "GET /users": ok([...DEFAULT_MEMBERS, { ...LENA, active: false }]),
      "POST /users/LENA/reactivate": ok(LENA),
    });
    await userEvent.click(await (await members()).findByRole("button", { name: "Lena reaktivieren" }));
    expect(await screen.findByText("Lena reaktiviert.")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.calls().some((call) => call.key === "POST /users/LENA/reactivate")).toBe(true),
    );
  });
});
