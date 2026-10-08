/** HOUSEHOLD-002: shared Tenners in the frontend. */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dashboard, dashboardTenner, tenner } from "../../tests/fixtures";
import { mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DashboardPage } from "../dashboard/DashboardPage";
import { CreateTennerDialog } from "../tenners/CreateTennerDialog";
import { TennersPage } from "../tenners/TennersPage";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("shared Tenners", () => {
  it("can be created for everyone", async () => {
    const fetchMock = mockFetch({ "POST /tenners": ok(tenner({ assignedTo: "HOUSEHOLD" }), 201) });
    const onClose = vi.fn();
    renderWithProviders(<CreateTennerDialog open onClose={onClose} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Titel" }), "Spülmaschine ausräumen");
    await userEvent.click(screen.getByRole("combobox", { name: "Zuständig" }));
    await userEvent.click(await screen.findByRole("option", { name: "Alle (gemeinsam)" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Aufgabe anlegen" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Aufgabe anlegen" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock.calls().find((call) => call.key === "POST /tenners")?.body).toMatchObject({
      assignedTo: "HOUSEHOLD",
    });
  });

  it("are marked on the dashboard (UI-001: no per-person summary any more)", async () => {
    mockFetch({
      "GET /dashboard": ok(
        dashboard({
          dueToday: [dashboardTenner({ assignedTo: "HOUSEHOLD", title: "Spülmaschine ausräumen" })],
          byUser: {
            STEFAN: { count: 2, estimatedMinutes: 15, sharedCount: 1 },
            JULIA: { count: 1, estimatedMinutes: 5, sharedCount: 1 },
          },
        }),
      ),
    });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("Gemeinsam · 10 Min.")).toBeInTheDocument();
  });

  it("can be filtered on the Tenners page", async () => {
    const fetchMock = mockFetch({ "GET /tenners": ok([tenner({ assignedTo: "HOUSEHOLD" })]) });
    renderWithProviders(<TennersPage />);
    expect(await screen.findByText("Gemeinsam · 10 Min.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Person" }));
    await userEvent.click(await screen.findByRole("option", { name: "Alle (gemeinsam)" }));
    await waitFor(() => expect(fetchMock.calls().some((call) => call.key.includes("assignedTo=HOUSEHOLD"))).toBe(true));
  });
});
