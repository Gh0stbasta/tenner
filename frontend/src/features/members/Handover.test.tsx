/** HOUSEHOLD-004: temporary handover in the member settings and on cards. */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboardTenner, tenner } from "../../tests/fixtures";
import { DEFAULT_MEMBERS, fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DashboardTennerCard } from "../dashboard/DashboardTennerCard";
import { SettingsPage } from "../settings/SettingsPage";

const LENA = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true };
const UNTIL = "2099-12-31";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

function setup(routes: Parameters<typeof mockFetch>[0] = {}) {
  const fetchMock = mockFetch({
    "GET /household": ok({ timezone: "Europe/Berlin" }),
    "GET /users": ok([...DEFAULT_MEMBERS, LENA]),
    "GET /tenners?assignedTo=STEFAN": ok([
      tenner({ tennerId: "a", assignedTo: "STEFAN" }),
      tenner({ tennerId: "b", assignedTo: "STEFAN", category: "HOME" }),
      // Shared Tenners come with a member filter (HOUSEHOLD-002) and are not handed over.
      tenner({ tennerId: "s", assignedTo: "HOUSEHOLD" }),
    ]),
    "GET /tenners?assignedTo=STEFAN&active=false": ok([
      tenner({ tennerId: "c", assignedTo: "STEFAN", category: "HOME", active: false }),
    ]),
    ...routes,
  });
  renderWithProviders(<SettingsPage />, { user: "STEFAN" });
  return fetchMock;
}

const members = async () => within(await screen.findByRole("list", { name: "Mitglieder" }));

async function openDialog() {
  await userEvent.click(await (await members()).findByRole("button", { name: "Tenner von Stefan übergeben" }));
  return within(await screen.findByRole("dialog", { name: "Tenner von Stefan übergeben" }));
}

describe("handover dialog", () => {
  it("previews and hands over all Tenners", async () => {
    const fetchMock = setup({
      "POST /users/STEFAN/handover": ok(
        { handover: { from: "STEFAN", to: "LENA", until: UNTIL, categories: null }, handedOver: 3 },
        201,
      ),
    });
    const dialog = await openDialog();
    expect(await dialog.findByRole("status")).toHaveTextContent("3 Tenner gehen an Julia.");
    await userEvent.click(dialog.getByRole("combobox", { name: "Übernimmt" }));
    await userEvent.click(await screen.findByRole("option", { name: "Lena" }));
    expect(dialog.getByRole("button", { name: "Übergeben" })).toBeDisabled();
    await userEvent.type(dialog.getByLabelText("Bis einschließlich"), UNTIL);
    expect(dialog.getByRole("status")).toHaveTextContent(/^3 Tenner gehen bis .+ an Lena\.$/);
    await userEvent.click(dialog.getByRole("button", { name: "Übergeben" }));
    expect(await screen.findByText("3 Tenner an Lena übergeben.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /users/STEFAN/handover")?.body).toEqual({
      to: "LENA",
      until: UNTIL,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("filters by category in the preview and the request", async () => {
    const fetchMock = setup({
      "POST /users/STEFAN/handover": ok(
        { handover: { from: "STEFAN", to: "JULIA", until: UNTIL, categories: ["HOME"] }, handedOver: 2 },
        201,
      ),
    });
    const dialog = await openDialog();
    await dialog.findByText("3 Tenner gehen an Julia.");
    await userEvent.click(dialog.getByRole("button", { name: "Haus & Garten" }));
    expect(dialog.getByRole("status")).toHaveTextContent("2 Tenner gehen an Julia.");
    await userEvent.type(dialog.getByLabelText("Bis einschließlich"), UNTIL);
    await userEvent.click(dialog.getByRole("button", { name: "Übergeben" }));
    await screen.findByText("2 Tenner an Julia übergeben.");
    expect(fetchMock.calls().find((call) => call.key === "POST /users/STEFAN/handover")?.body).toEqual({
      to: "JULIA",
      until: UNTIL,
      categories: ["HOME"],
    });
  });

  it("rejects past dates and shows server errors", async () => {
    setup({ "POST /users/STEFAN/handover": fail(409, "HANDOVER_ACTIVE", "Already handed over.") });
    const dialog = await openDialog();
    const until = dialog.getByLabelText("Bis einschließlich");
    await userEvent.type(until, "2020-01-01");
    expect(dialog.getByText("Liegt in der Vergangenheit.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Übergeben" })).toBeDisabled();
    await userEvent.clear(until);
    await userEvent.type(until, UNTIL);
    await userEvent.click(dialog.getByRole("button", { name: "Übergeben" }));
    expect(await dialog.findByText(/^Übergabe fehlgeschlagen\./)).toBeInTheDocument();
  });

  it("does not offer members who are away themselves", async () => {
    setup({
      "GET /household": ok({
        timezone: "Europe/Berlin",
        handovers: [{ from: "JULIA", to: "LENA", until: UNTIL, categories: null }],
      }),
    });
    const dialog = await openDialog();
    await userEvent.click(dialog.getByRole("combobox", { name: "Übernimmt" }));
    expect(await screen.findByRole("option", { name: "Lena" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Julia" })).not.toBeInTheDocument();
  });
});

describe("running handovers", () => {
  it("shows the cover and ends the handover", async () => {
    const fetchMock = setup({
      "GET /household": ok({
        timezone: "Europe/Berlin",
        handovers: [{ from: "STEFAN", to: "JULIA", until: UNTIL, categories: null }],
      }),
      "DELETE /users/STEFAN/handover": ok({ returned: 2 }),
    });
    const list = await members();
    expect(await list.findByText(/^STEFAN · Vertreten von Julia bis /)).toBeInTheDocument();
    expect(list.queryByRole("button", { name: "Tenner von Stefan übergeben" })).not.toBeInTheDocument();
    await userEvent.click(list.getByRole("button", { name: "Vertretung für Stefan beenden" }));
    expect(await screen.findByText("Vertretung beendet. 2 Tenner zurück an Stefan.")).toBeInTheDocument();
    expect(fetchMock.calls().some((call) => call.key === "DELETE /users/STEFAN/handover")).toBe(true);
  });

  it("reports a failed end", async () => {
    setup({
      "GET /household": ok({
        timezone: "Europe/Berlin",
        handovers: [{ from: "STEFAN", to: "JULIA", until: UNTIL, categories: null }],
      }),
      "DELETE /users/STEFAN/handover": fail(404, "NOT_FOUND", "This member has no handover."),
    });
    await userEvent.click(await (await members()).findByRole("button", { name: "Vertretung für Stefan beenden" }));
    expect(await screen.findByText(/^Vertretung beenden fehlgeschlagen\./)).toBeInTheDocument();
  });

  it("marks covered Tenners on cards", async () => {
    mockFetch({});
    renderWithProviders(
      <DashboardTennerCard
        variant="upcoming"
        tenner={dashboardTenner({ assignedTo: "JULIA", originalAssignee: "STEFAN" })}
      />,
    );
    expect(await screen.findByText("Julia (für Stefan) · 10 Min.")).toBeInTheDocument();
  });
});
