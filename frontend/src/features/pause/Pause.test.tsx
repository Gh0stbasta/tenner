/** SCHEDULING-005: pause, resume, paused dashboard section and vacation settings. */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dashboard, dashboardTenner, tenner } from "../../tests/fixtures";
import { mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DashboardPage } from "../dashboard/DashboardPage";
import { SettingsPage } from "../settings/SettingsPage";
import { tennerStatus } from "../tenners/status";
import { TennersPage } from "../tenners/TennersPage";
import { isPaused, pausedUntil } from "./pauseStatus";

// Friday, 2 Oct 2026, 12:00 in Berlin.
const TODAY = "2026-10-02";
const VACATION = { from: "2026-10-01", until: "2026-10-09", categories: ["HOME" as const] };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => vi.useRealTimers());

describe("pause status", () => {
  it("mirrors the backend rules", () => {
    expect(isPaused(tenner({ pausedAt: "x", pausedUntil: "2026-10-02" }), null, TODAY)).toBe(true);
    expect(isPaused(tenner({ pausedAt: "x", pausedUntil: "2026-10-01" }), null, TODAY)).toBe(false);
    expect(isPaused(tenner({ category: "HOME" }), VACATION, TODAY)).toBe(true);
    expect(isPaused(tenner({ category: "FITNESS" }), VACATION, TODAY)).toBe(false);
    expect(pausedUntil(tenner({ category: "HOME", pausedAt: "x", pausedUntil: "2026-10-20" }), VACATION, TODAY)).toBe(
      "2026-10-20",
    );
    expect(pausedUntil(tenner({ pausedAt: "x", pausedUntil: null }), null, TODAY)).toBeNull();
  });

  it("shows paused Tenners with their end date instead of a due status", () => {
    expect(tennerStatus(tenner({ nextDue: "2026-09-20", pausedAt: "x", pausedUntil: "2026-10-09" }), TODAY)).toEqual({
      kind: "paused",
      label: "Pausiert bis Fr., 9. Okt.",
    });
    expect(tennerStatus(tenner({ pausedAt: "x", pausedUntil: null }), TODAY).label).toBe("Pausiert");
    expect(tennerStatus(tenner({ category: "HOME" }), TODAY, VACATION).label).toBe("Pausiert bis Fr., 9. Okt.");
  });
});

describe("pause and resume on the Tenners page", () => {
  it("pauses until a date", async () => {
    const fetchMock = mockFetch({
      "GET /tenners": ok([tenner()]),
      "POST /tenners/t-1/pause": ok(tenner({ pausedAt: "2026-10-02T10:00:00Z", pausedUntil: "2026-10-09" })),
    });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ pausieren" }));
    const dialog = await screen.findByRole("dialog", { name: "„Büro saugen“ pausieren" });
    fireEvent.change(within(dialog).getByLabelText(/Pausiert bis einschließlich/), { target: { value: "2026-10-09" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Pausieren" }));

    expect(await screen.findByText("⏸ „Büro saugen“ pausiert bis Fr., 9. Okt.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /tenners/t-1/pause")?.body).toEqual({
      until: "2026-10-09",
    });
  });

  it("pauses open-ended and rejects past dates in the dialog", async () => {
    const fetchMock = mockFetch({
      "GET /tenners": ok([tenner()]),
      "POST /tenners/t-1/pause": ok(tenner({ pausedAt: "2026-10-02T10:00:00Z" })),
    });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ pausieren" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/Pausiert bis einschließlich/);
    fireEvent.change(input, { target: { value: TODAY } });
    expect(within(dialog).getByRole("button", { name: "Pausieren" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Pausieren" }));
    expect(await screen.findByText("⏸ „Büro saugen“ pausiert.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /tenners/t-1/pause")?.body).toEqual({});
  });

  it("resumes an individually paused Tenner", async () => {
    const fetchMock = mockFetch({
      "GET /tenners": ok([tenner({ pausedAt: "2026-09-30T10:00:00Z", pausedUntil: null })]),
      "POST /tenners/t-1/resume": ok(tenner()),
    });
    renderWithProviders(<TennersPage />);
    expect(await screen.findByText("Pausiert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "„Büro saugen“ fortsetzen" }));
    expect(await screen.findByText("▶ „Büro saugen“ fortgesetzt.")).toBeInTheDocument();
    expect(fetchMock.calls().some((call) => call.key === "POST /tenners/t-1/resume")).toBe(true);
  });
});

describe("paused section on the dashboard", () => {
  it("lists paused Tenners with their pause end", async () => {
    mockFetch({
      "GET /dashboard": ok(
        dashboard({
          paused: [
            {
              ...dashboardTenner({ tennerId: "p-1", title: "Rasen mähen" }),
              pausedUntil: "2026-10-09",
              pauseReason: "PAUSE",
            },
            {
              ...dashboardTenner({ tennerId: "p-2", title: "Fenster putzen" }),
              pausedUntil: null,
              pauseReason: "PAUSE",
            },
            {
              ...dashboardTenner({ tennerId: "p-3", title: "Bad putzen" }),
              pausedUntil: "2026-10-09",
              pauseReason: "VACATION",
            },
          ],
        }),
      ),
    });
    renderWithProviders(<DashboardPage />);
    const section = within(await screen.findByRole("region", { name: /^Pausiert/ }));
    expect(section.getByText("Pausiert bis Fr., 9. Okt.")).toBeInTheDocument();
    expect(section.getByText("Pausiert bis auf Weiteres")).toBeInTheDocument();
    expect(section.getByText("Urlaub bis Fr., 9. Okt.")).toBeInTheDocument();
    expect(section.queryByRole("button", { name: /erledigen/ })).not.toBeInTheDocument();
  });
});

describe("vacation settings", () => {
  it("saves a vacation for selected categories", async () => {
    const fetchMock = mockFetch({
      "GET /household": ok({ timezone: "Europe/Berlin", vacation: null }),
      "PUT /household/vacation": ok({
        household: {
          timezone: "Europe/Berlin",
          vacation: { from: "2026-10-10", until: "2026-10-24", categories: ["HOUSEHOLD", "HOME"] },
        },
        rescheduled: 4,
        conflicts: 1,
      }),
    });
    renderWithProviders(<SettingsPage />);
    fireEvent.change(await screen.findByLabelText("Von"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("Bis einschließlich"), { target: { value: "2026-10-24" } });
    const categories = screen.getByRole("group", { name: "Pausierte Kategorien (ohne Auswahl: alle)" });
    await userEvent.click(within(categories).getByRole("button", { name: "Haus & Garten" }));
    await userEvent.click(within(categories).getByRole("button", { name: "Haushalt" }));
    await userEvent.click(screen.getByRole("button", { name: "Urlaub speichern" }));

    expect(
      await screen.findByText(
        "🏖 Urlaub gespeichert. 4 Aufgaben nach hinten verschoben. 1 wurden gerade geändert und behalten ihr Datum.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "PUT /household/vacation")?.body).toEqual({
      from: "2026-10-10",
      until: "2026-10-24",
      categories: ["HOUSEHOLD", "HOME"],
    });
    expect(
      await screen.findByText(/^Geplant: Sa\., 10\. Okt\. – Sa\., 24\. Okt\. · Haushalt, Haus & Garten/),
    ).toBeInTheDocument();
  });

  it("validates the range and ends a vacation", async () => {
    const fetchMock = mockFetch({
      "GET /household": ok({
        timezone: "Europe/Berlin",
        vacation: { from: "2026-10-01", until: "2026-10-09", categories: null },
      }),
      "DELETE /household/vacation": ok({ timezone: "Europe/Berlin", vacation: null }),
    });
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText(/alle Kategorien/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Bis einschließlich"), { target: { value: "2026-09-30" } });
    expect(screen.getByText("Liegt vor dem Beginn.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Urlaub speichern" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Urlaub beenden" }));
    expect(await screen.findByText("Urlaub beendet.")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.calls().some((call) => call.key === "DELETE /household/vacation")).toBe(true));
  });
});
