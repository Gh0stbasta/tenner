import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fail, mockFetch, ok, TEST_API_BASE_URL } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { calendarUrls } from "./api";
import { MealCalendarSettings } from "./MealCalendarSettings";

const section = () => within(screen.getByRole("region", { name: "Essen: Kalender" }));
const TOKEN = `default.${"a".repeat(43)}`;

describe("MealCalendarSettings (FOOD-015)", () => {
  it("builds https and webcal links", () => {
    expect(calendarUrls("t.x", "https://api.test/prod")).toEqual({
      https: "https://api.test/prod/meals/calendar/t.x.ics",
      webcal: "webcal://api.test/prod/meals/calendar/t.x.ics",
    });
  });

  it("creates a link, shows it once with copy and Apple buttons", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const fetchMock = mockFetch({
      "GET /meals/calendar": ok({ active: false, createdAt: null }),
      "POST /meals/calendar": ok({ token: TOKEN, createdAt: "2026-10-10T08:00:00Z" }, 201),
    });
    renderWithProviders(<MealCalendarSettings />);
    expect(await section().findByText("Noch kein Kalender-Link.")).toBeInTheDocument();
    await userEvent.click(section().getByRole("button", { name: "Kalender abonnieren" }));
    const link = `${TEST_API_BASE_URL}/meals/calendar/${TOKEN}.ics`;
    expect(await section().findByLabelText("Kalender-Link")).toHaveValue(link);
    expect(section().getByText(/nur jetzt angezeigt/)).toBeInTheDocument();
    expect(section().getByRole("link", { name: "In Apple Kalender öffnen" })).toHaveAttribute(
      "href",
      link.replace("https:", "webcal:"),
    );
    await userEvent.click(section().getByRole("button", { name: "Link kopieren" }));
    expect(writeText).toHaveBeenCalledWith(link);
    expect(await screen.findByText("Kalender-Link kopiert.")).toBeInTheDocument();
    await userEvent.click(section().getByRole("button", { name: "Fertig" }));
    expect(section().queryByLabelText("Kalender-Link")).not.toBeInTheDocument();
    expect(fetchMock.calls().filter((call) => call.key === "POST /meals/calendar")).toHaveLength(1);
  });

  it("revokes an active link and shows errors", async () => {
    const fetchMock = mockFetch({
      "GET /meals/calendar": ok({ active: true, createdAt: "2026-10-09T08:00:00Z" }),
      "DELETE /meals/calendar": ok({ active: false, createdAt: null }),
    });
    renderWithProviders(<MealCalendarSettings />);
    expect(await section().findByText(/Ein Kalender-Link ist aktiv \(erstellt am/)).toBeInTheDocument();
    expect(section().getByRole("button", { name: "Neuen Link erstellen" })).toBeInTheDocument();
    await userEvent.click(section().getByRole("button", { name: "Link widerrufen" }));
    expect(await screen.findByText(/Kalender-Link widerrufen/)).toBeInTheDocument();
    expect(fetchMock.calls().some((call) => call.key === "DELETE /meals/calendar")).toBe(true);
  });

  it("explains a failed request", async () => {
    mockFetch({
      "GET /meals/calendar": ok({ active: false, createdAt: null }),
      "POST /meals/calendar": fail(503, "SERVICE_UNAVAILABLE"),
    });
    renderWithProviders(<MealCalendarSettings />);
    await userEvent.click(await section().findByRole("button", { name: "Kalender abonnieren" }));
    expect(await section().findByText(/nicht erreichbar/)).toBeInTheDocument();
  });
});
