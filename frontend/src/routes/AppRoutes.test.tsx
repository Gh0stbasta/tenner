import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetch, ok } from "../tests/fetchMock";
import { dashboard } from "../tests/fixtures";
import { renderWithProviders } from "../tests/render";
import { AppRoutes } from "./AppRoutes";

vi.mock("react-oidc-context", () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    error: undefined,
    activeNavigator: undefined,
    user: { profile: { "cognito:groups": ["household:default:JULIA"] }, state: undefined },
    signinRedirect: vi.fn(),
  }),
}));

function renderRoutes(route: string, onLogout = vi.fn()) {
  renderWithProviders(<AppRoutes onLogout={onLogout} />, { route, withoutSession: true });
  return onLogout;
}

describe("AppRoutes", () => {
  beforeEach(() => {
    mockFetch({ "GET /dashboard": ok(dashboard()), "GET /history": ok({ items: [], nextCursor: null }) });
  });

  it("redirects / to the dashboard", async () => {
    renderRoutes("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Heute" })).toBeInTheDocument();
  });

  it.each([
    ["/analytics", "Auswertung"],
    ["/settings", "Einstellungen"],
  ])("renders %s", (route, title) => {
    renderRoutes(route);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });

  it("shows a not-found page for unknown routes", () => {
    renderRoutes("/unbekannt");
    expect(screen.getByText("Seite nicht gefunden")).toBeInTheDocument();
  });

  it("shows the logged-in user from the token and logs out", async () => {
    const onLogout = renderRoutes("/settings");
    await userEvent.click(screen.getByRole("button", { name: "Angemeldet als Julia" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Abmelden" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("navigates through the side navigation and the bottom navigation (MOBILE-005)", async () => {
    renderRoutes("/settings");
    const [side, bottom] = screen.getAllByRole("navigation", { name: "Hauptnavigation" });
    await userEvent.click(within(side as HTMLElement).getByRole("link", { name: "Auswertung" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Auswertung" })).toBeInTheDocument();
    await userEvent.click(within(bottom as HTMLElement).getByRole("link", { name: "Einstellungen" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Einstellungen" })).toBeInTheDocument();
  });
});
