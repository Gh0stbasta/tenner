import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../tests/render";
import { AppRoutes } from "./AppRoutes";

describe("AppRoutes", () => {
  it("redirects / to /dashboard", () => {
    renderWithProviders(<AppRoutes />, { route: "/" });
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
  });

  it.each([
    ["/tenners", "Tenner"],
    ["/analytics", "Auswertung"],
    ["/settings", "Einstellungen"],
  ])("renders %s", (route, title) => {
    renderWithProviders(<AppRoutes />, { route });
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });

  it("shows a not-found page for unknown routes", () => {
    renderWithProviders(<AppRoutes />, { route: "/unbekannt" });
    expect(screen.getByText("Seite nicht gefunden")).toBeInTheDocument();
  });

  it("navigates through the main navigation and opens the mobile drawer", async () => {
    renderWithProviders(<AppRoutes />, { route: "/dashboard" });
    await userEvent.click(screen.getByRole("button", { name: "Navigation öffnen" }));
    const [nav] = screen.getAllByRole("navigation", { name: "Hauptnavigation" });
    await userEvent.click(within(nav as HTMLElement).getByRole("link", { name: "Einstellungen" }));
    // The drawer closes after navigation; the page becomes accessible again once the transition ends.
    expect(await screen.findByRole("heading", { level: 1, name: "Einstellungen" })).toBeInTheDocument();
  });
});
