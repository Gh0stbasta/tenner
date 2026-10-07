import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_RESPONSE, fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { NotificationSettings } from "./NotificationSettings";

/** PUT echoes the saved preferences. */
const echo =
  (connected: string[] = []) =>
  ({ init }: { init: RequestInit | undefined }) =>
    ok({
      ...DEFAULT_NOTIFICATION_RESPONSE,
      preferences: JSON.parse(String(init?.body)),
      channels: DEFAULT_NOTIFICATION_RESPONSE.channels.map((channel) => ({
        ...channel,
        connected: connected.includes(channel.type),
      })),
    });

describe("NotificationSettings (NOTIFICATION-002)", () => {
  it("shows the defaults for the signed-in member and saves a change (Frontend Save And Reload)", async () => {
    const fetchMock = mockFetch({ "PUT /users/JULIA/notification-preferences": echo() });
    renderWithProviders(<NotificationSettings />, { user: "JULIA" });
    const digest = await screen.findByRole("switch", { name: "Tagesüberblick" });
    expect(digest).toBeChecked();
    expect(screen.getByText(/Noch kein Kanal verbunden/)).toBeInTheDocument();
    expect(screen.getByText("Zeitzone: Europe/Berlin")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "Wochenrückblick" }));
    await waitFor(() =>
      expect(fetchMock.calls().some((call) => call.key === "PUT /users/JULIA/notification-preferences")).toBe(true),
    );
    const put = fetchMock.calls().find((call) => call.key === "PUT /users/JULIA/notification-preferences");
    expect(put?.body).toMatchObject({
      weeklySummary: { enabled: true, dayOfWeek: "SUN", time: "18:00" },
      dailyDigest: { time: "08:00" },
      overdueAlerts: { time: "18:00" },
    });
    expect(await screen.findByRole("combobox", { name: "Tag" })).toBeInTheDocument();
  });

  it("changes the digest time in 15-minute steps", async () => {
    const fetchMock = mockFetch({ "PUT /users/STEFAN/notification-preferences": echo() });
    renderWithProviders(<NotificationSettings />);
    const [time] = await screen.findAllByRole("combobox", { name: "Uhrzeit" });
    await userEvent.click(time as HTMLElement);
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(96);
    await userEvent.click(screen.getByRole("option", { name: "06:45" }));
    await waitFor(() =>
      expect(fetchMock.calls().find((call) => call.key.startsWith("PUT"))?.body).toMatchObject({
        dailyDigest: { time: "06:45" },
      }),
    );
  });

  it("rejects an invalid number of days before saving (Frontend Form Validation)", async () => {
    const fetchMock = mockFetch({ "PUT /users/STEFAN/notification-preferences": echo() });
    renderWithProviders(<NotificationSettings />);
    const days = await screen.findByLabelText("Ab Tagen überfällig");
    await userEvent.clear(days);
    await userEvent.type(days, "45");
    expect(screen.getByText("Bitte eine ganze Zahl von 0 bis 30 eingeben.")).toBeInTheDocument();
    await userEvent.tab();
    expect(fetchMock.calls().some((call) => call.key.startsWith("PUT"))).toBe(false);
  });

  it("offers connected channels only", async () => {
    mockFetch({
      "GET /users/STEFAN/notification-preferences": ok({
        ...DEFAULT_NOTIFICATION_RESPONSE,
        channels: DEFAULT_NOTIFICATION_RESPONSE.channels.map((channel) => ({
          ...channel,
          connected: channel.type === "ALEXA",
        })),
      }),
      "PUT /users/STEFAN/notification-preferences": echo(["ALEXA"]),
    });
    renderWithProviders(<NotificationSettings />);
    const group = await screen.findByRole("group", { name: "Kanäle für den Tagesüberblick" });
    expect(
      within(group)
        .getAllByRole("checkbox")
        .map((box) => box.getAttribute("name") ?? box.closest("label")?.textContent),
    ).toEqual(["Alexa"]);
    await userEvent.click(within(group).getByRole("checkbox", { name: "Alexa" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("group", { name: "Kanäle für den Tagesüberblick" })).getByRole("checkbox", {
          name: "Alexa",
        }),
      ).toBeChecked(),
    );
    expect(screen.queryByText(/Noch kein Kanal verbunden/)).not.toBeInTheDocument();
  });

  it("offers push and the „Später“ choice once push is connected (NOTIFICATION-009/011)", async () => {
    const fetchMock = mockFetch({
      "GET /users/STEFAN/notification-preferences": ok({
        ...DEFAULT_NOTIFICATION_RESPONSE,
        channels: DEFAULT_NOTIFICATION_RESPONSE.channels.map((channel) => ({
          ...channel,
          connected: channel.type === "WEB_PUSH",
        })),
      }),
      "PUT /users/STEFAN/notification-preferences": echo(["WEB_PUSH"]),
    });
    renderWithProviders(<NotificationSettings />);
    const group = await screen.findByRole("group", { name: "Kanäle für Überfällig-Hinweise" });
    expect(within(group).getByRole("checkbox", { name: "Push aufs Handy" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "„Später“ in Push-Benachrichtigungen" }));
    await userEvent.click(await screen.findByRole("option", { name: "Heute Abend (Uhrzeit der Überfällig-Hinweise)" }));
    await waitFor(() =>
      expect(
        fetchMock.calls().find((call) => call.key === "PUT /users/STEFAN/notification-preferences")?.body,
      ).toMatchObject({
        pushSnooze: "EVENING",
      }),
    );
  });

  it("hides the „Später“ choice without push", async () => {
    mockFetch({});
    renderWithProviders(<NotificationSettings />);
    await screen.findByRole("switch", { name: "Tagesüberblick" });
    expect(screen.queryByRole("combobox", { name: "„Später“ in Push-Benachrichtigungen" })).not.toBeInTheDocument();
  });

  it("turns quiet hours off and reports load errors", async () => {
    const fetchMock = mockFetch({ "PUT /users/STEFAN/notification-preferences": echo() });
    renderWithProviders(<NotificationSettings />);
    await userEvent.click(await screen.findByRole("switch", { name: "Ruhezeit" }));
    await waitFor(() =>
      expect(fetchMock.calls().find((call) => call.key.startsWith("PUT"))?.body).toMatchObject({ quietHours: null }),
    );

    mockFetch({ "GET /users/STEFAN/notification-preferences": fail(503, "SERVICE_UNAVAILABLE") });
    renderWithProviders(<NotificationSettings />);
    expect(await screen.findByText(/Benachrichtigungen konnten nicht geladen werden/)).toBeInTheDocument();
  });
});
