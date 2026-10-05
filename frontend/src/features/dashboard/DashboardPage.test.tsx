import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { completeResponse, dashboard } from "../../tests/fixtures";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DEFAULT_PREFERENCES } from "../settings/preferences";
import { DashboardPage } from "./DashboardPage";

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name: new RegExp(`^${name}`) });
}

describe("DashboardPage", () => {
  it("shows loading skeletons first", () => {
    mockFetch({ "GET /dashboard": ok(dashboard()) });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole("status", { name: "Dashboard wird geladen" })).toBeInTheDocument();
  });

  it("renders header, summary and all sections", async () => {
    mockFetch({ "GET /dashboard": ok(dashboard()) });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Heute" })).toBeInTheDocument();
    expect(screen.getByText("Freitag, 2. Oktober · 2 Tenner · 25 Min. · 1 überfällig")).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "Übersicht" });
    expect(within(summary).getByText("Heute fällig").nextSibling).toHaveTextContent("1");
    expect(within(summary).getByText("Minuten offen").nextSibling).toHaveTextContent("25");

    const dueToday = section("Heute fällig");
    expect(within(dueToday).getByText("Büro saugen")).toBeInTheDocument();
    expect(await within(dueToday).findByText("Haushalt")).toBeInTheDocument();
    expect(within(dueToday).getByText("Stefan · 10 Min.")).toBeInTheDocument();

    expect(within(section("Überfällig")).getByText("seit 12 Tagen überfällig")).toBeInTheDocument();
    const upcoming = section("Demnächst");
    expect(within(upcoming).getByText("fällig in 3 Tagen")).toBeInTheDocument();
    expect(within(upcoming).queryByRole("button")).not.toBeInTheDocument();

    expect(within(screen.getByRole("region", { name: "Nach Person" })).getByText("Julia")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Nach Kategorie" })).getByText("1 Tenner · 15 Min."),
    ).toBeInTheDocument();
  });

  it("links Tenners to their detail page", async () => {
    mockFetch({ "GET /dashboard": ok(dashboard()) });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole("link", { name: "Haustür putzen" })).toHaveAttribute("href", "/tenners/t-2");
  });

  it("shows positive feedback instead of empty lists when nothing is actionable", async () => {
    mockFetch({
      "GET /dashboard": ok(dashboard({ dueToday: [], overdue: [], upcoming: [], byUser: {}, byCategory: {} })),
    });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("🎉 Alles erledigt.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Heute fällig/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Nichts offen.")).toHaveLength(2);
  });

  it("shows an error with retry", async () => {
    let calls = 0;
    mockFetch({ "GET /dashboard": () => (++calls === 1 ? fail(500, "INTERNAL_ERROR") : ok(dashboard())) });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("Dashboard konnte nicht geladen werden")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Büro saugen")).toBeInTheDocument();
  });

  it("completes a Tenner with the estimated minutes and refreshes the dashboard", async () => {
    let dashboardCalls = 0;
    const fetchMock = mockFetch({
      "GET /dashboard": () => (++dashboardCalls === 1 ? ok(dashboard()) : ok(dashboard({ dueToday: [] }))),
      "POST /tenners/t-1/complete": ok(completeResponse()),
    });
    renderWithProviders(<DashboardPage />);

    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ erledigen" }));

    await waitFor(() => expect(screen.queryByText("Büro saugen")).not.toBeInTheDocument());
    const post = fetchMock.calls().find((call) => call.key === "POST /tenners/t-1/complete");
    expect(post?.body).toEqual({ completedBy: "STEFAN" });
    expect(post?.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(dashboardCalls).toBe(2);
  });

  it("completes overdue Tenners too and shows an error when completion fails", async () => {
    mockFetch({
      "GET /dashboard": ok(dashboard()),
      "POST /tenners/t-2/complete": fail(409, "CONCURRENT_MODIFICATION"),
    });
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Haustür putzen“ erledigen" }));
    expect(
      await screen.findByText(
        "„Haustür putzen“ konnte nicht erledigt werden. Jemand anderes hat diesen Tenner geändert. Lade neu, um den aktuellen Stand zu sehen.",
      ),
    ).toBeInTheDocument();
    // The optimistic removal is rolled back.
    expect(await screen.findByRole("button", { name: "„Haustür putzen“ erledigen" })).toBeInTheDocument();
  });

  it("honors the dashboard preferences (FRONTEND-008)", async () => {
    mockFetch({ "GET /dashboard": ok(dashboard()), "GET /history": ok({ items: [], nextCursor: null }) });
    renderWithProviders(<DashboardPage />, {
      preferences: {
        ...DEFAULT_PREFERENCES,
        showUpcoming: false,
        showUserSummary: false,
        showCategorySummary: false,
        showRecentActivity: false,
      },
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Heute" })).toBeInTheDocument();
    expect(section("Heute fällig")).toBeInTheDocument();
    expect(section("Überfällig")).toBeInTheDocument();
    for (const hidden of [/^Demnächst/, /^Nach Person/, /^Nach Kategorie/, /^Zuletzt erledigt/]) {
      expect(screen.queryByRole("region", { name: hidden })).not.toBeInTheDocument();
    }
  });
});
