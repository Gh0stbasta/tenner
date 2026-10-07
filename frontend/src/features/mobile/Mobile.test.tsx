/** MOBILE-005: one-thumb navigation, swipe gestures, pull to refresh, touch targets. */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetch, ok } from "../../tests/fetchMock";
import { completeResponse, dashboard, dashboardTenner } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { AppLayout } from "../../layouts/AppLayout";
import { COARSE, createAppTheme, TOUCH_TARGET } from "../../theme/theme";
import { DashboardPage } from "../dashboard/DashboardPage";
import { DashboardTennerCard } from "../dashboard/DashboardTennerCard";
import { PULL_THRESHOLD, PullToRefresh } from "./PullToRefresh";
import { SWIPE_THRESHOLD } from "./useSwipe";

/** A touch gesture from (x, y) by (dx, dy). */
function swipe(element: Element, dx: number, dy = 0, start = { x: 100, y: 100 }) {
  fireEvent.touchStart(element, { touches: [{ clientX: start.x, clientY: start.y }] });
  fireEvent.touchMove(element, { touches: [{ clientX: start.x + dx / 2, clientY: start.y + dy / 2 }] });
  fireEvent.touchMove(element, { touches: [{ clientX: start.x + dx, clientY: start.y + dy }] });
  fireEvent.touchEnd(element, { touches: [] });
}

const cardOf = (title: string) => screen.getByRole("link", { name: title }).closest(".MuiCard-root") as HTMLElement;

describe("swipe on dashboard cards", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));
  afterEach(() => vi.unstubAllGlobals());

  it("completes on a swipe to the right, with haptic feedback", async () => {
    const vibrate = vi.fn();
    vi.stubGlobal(
      "navigator",
      Object.create(navigator, { vibrate: { value: vibrate }, onLine: { value: true } }) as Navigator,
    );
    const fetchMock = mockFetch({ "POST /tenners/t-1/complete": ok(completeResponse()) });
    renderWithProviders(<DashboardTennerCard tenner={dashboardTenner()} variant="dueToday" completable />);
    swipe(cardOf("Büro saugen"), SWIPE_THRESHOLD + 20);
    await waitFor(() => expect(fetchMock.calls().some((call) => call.key === "POST /tenners/t-1/complete")).toBe(true));
    expect(vibrate).toHaveBeenCalledWith(15);
  });

  it("opens the snooze menu on a swipe to the left", async () => {
    mockFetch({ "GET /household": ok({ timezone: "Europe/Berlin" }) });
    renderWithProviders(<DashboardTennerCard tenner={dashboardTenner()} variant="dueToday" completable />);
    swipe(cardOf("Büro saugen"), -(SWIPE_THRESHOLD + 20));
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("ignores short and vertical gestures, and cards without actions", () => {
    const fetchMock = mockFetch({});
    const { unmount } = renderWithProviders(
      <DashboardTennerCard tenner={dashboardTenner()} variant="dueToday" completable />,
    );
    swipe(cardOf("Büro saugen"), SWIPE_THRESHOLD - 20);
    swipe(cardOf("Büro saugen"), 30, 200); // scrolling the page
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<DashboardTennerCard tenner={dashboardTenner()} variant="upcoming" />);
    swipe(cardOf("Büro saugen"), SWIPE_THRESHOLD + 20);
    expect(fetchMock.calls().filter((call) => call.key.startsWith("POST"))).toHaveLength(0);
  });

  it("keeps the visible buttons as alternatives to the gestures", () => {
    mockFetch({});
    renderWithProviders(<DashboardTennerCard tenner={dashboardTenner()} variant="dueToday" completable />);
    expect(screen.getByRole("button", { name: "„Büro saugen“ erledigen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "„Büro saugen“ verschieben" })).toBeInTheDocument();
  });

  it("shows what the swipe will do while dragging", () => {
    mockFetch({});
    renderWithProviders(<DashboardTennerCard tenner={dashboardTenner()} variant="dueToday" completable />);
    const card = cardOf("Büro saugen");
    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(card, { touches: [{ clientX: 200, clientY: 100 }] });
    // The hint behind the card plus the button text.
    expect(screen.getAllByText("Erledigt")).toHaveLength(2);
    expect(getComputedStyle(card).transform).toBe("translateX(100px)");
    fireEvent.touchCancel(card);
    expect(screen.getAllByText("Erledigt")).toHaveLength(1);
  });
});

describe("pull to refresh", () => {
  it("refreshes when pulled down far enough at the top", async () => {
    const onRefresh = vi.fn(async () => undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>Inhalt</p>
      </PullToRefresh>,
    );
    const area = screen.getByText("Inhalt").parentElement as HTMLElement;
    swipe(area, 0, PULL_THRESHOLD * 2 - 10);
    expect(onRefresh).not.toHaveBeenCalled();
    swipe(area, 0, PULL_THRESHOLD * 2 + 10);
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Wird aktualisiert")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Wird aktualisiert")).not.toBeInTheDocument());
  });

  it("does nothing when the page is scrolled down", () => {
    const onRefresh = vi.fn(async () => undefined);
    vi.stubGlobal("scrollY", 300);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>Inhalt</p>
      </PullToRefresh>,
    );
    swipe(screen.getByText("Inhalt").parentElement as HTMLElement, 0, 300);
    expect(onRefresh).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reloads the dashboard data", async () => {
    const fetchMock = mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /history": ok({ items: [], nextCursor: null }),
    });
    renderWithProviders(<DashboardPage />);
    const heading = await screen.findByRole("heading", { level: 1, name: "Heute" });
    const before = fetchMock.calls().filter((call) => call.key === "GET /dashboard").length;
    swipe(heading, 0, 300);
    await waitFor(() =>
      expect(fetchMock.calls().filter((call) => call.key === "GET /dashboard").length).toBe(before + 1),
    );
  });
});

describe("mobile navigation", () => {
  function renderLayout(route: string) {
    return renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<input id="quick-add-input" aria-label="Quick Add" />} />
          <Route path="settings" element={<h1>Einstellungen</h1>} />
        </Route>
      </Routes>,
      { route },
    );
  }

  it("has a bottom navigation with every main page and marks the current one", () => {
    mockFetch({});
    renderLayout("/settings");
    const bottom = screen.getAllByRole("navigation", { name: "Hauptnavigation" })[1] as HTMLElement;
    expect(
      within(bottom)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Dashboard", "Tenner", "Essen", "Auswertung", "Einstellungen"]);
    expect(within(bottom).getByRole("link", { name: "Einstellungen" })).toHaveClass("Mui-selected");
  });

  it("the Quick Add button focuses the Quick Add input or opens the dashboard with it", async () => {
    mockFetch({});
    renderLayout("/dashboard");
    Element.prototype.scrollIntoView = vi.fn();
    await userEvent.click(screen.getByRole("button", { name: "Tenner schnell anlegen" }));
    expect(screen.getByRole("textbox", { name: "Quick Add" })).toHaveFocus();
  });

  it("navigates to the dashboard Quick Add from other pages", async () => {
    mockFetch({});
    renderLayout("/settings");
    await userEvent.click(screen.getByRole("button", { name: "Tenner schnell anlegen" }));
    expect(await screen.findByRole("textbox", { name: "Quick Add" })).toBeInTheDocument();
  });

  it("covers the notch with viewport-fit=cover", () => {
    expect(readFileSync("index.html", "utf8")).toContain("viewport-fit=cover");
  });
});

describe("touch targets", () => {
  it("are at least 44 px on touch screens", () => {
    const components = createAppTheme("light").components;
    for (const name of ["MuiButton", "MuiIconButton", "MuiToggleButton"] as const) {
      expect((components?.[name]?.styleOverrides as { root: Record<string, unknown> }).root[COARSE]).toEqual(
        TOUCH_TARGET,
      );
    }
    expect((components?.MuiChip?.styleOverrides as { clickable: Record<string, unknown> }).clickable[COARSE]).toEqual({
      minHeight: 44,
    });
  });
});
