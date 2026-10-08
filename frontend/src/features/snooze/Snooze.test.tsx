/** SCHEDULING-003: snooze menu, date picker and badge. */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dashboard, dashboardTenner, tenner } from "../../tests/fixtures";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DashboardPage } from "../dashboard/DashboardPage";
import { TennerDetailHeader } from "../tenner-detail/TennerDetailHeader";
import { addDaysIso, nextWeekend, snoozeOptions, snoozeTarget } from "./snoozeOptions";

// Friday, 2 Oct 2026, 12:00 in Berlin.
const TODAY = "2026-10-02";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => vi.useRealTimers());

function snoozed(until: string) {
  return {
    tenner: tenner({ nextDue: until, snoozedUntil: until }),
    snooze: {
      snoozeId: "s-1",
      snoozedBy: "STEFAN",
      snoozedAt: "2026-10-02T10:00:00Z",
      previousNextDue: TODAY,
      snoozedUntil: until,
    },
  };
}

/** UI-001: today's open Aufgaben are in „Heute erledigen wir“. */
function dueToday() {
  return within(screen.getByRole("region", { name: "Heute erledigen wir" }));
}

describe("snoozeOptions", () => {
  it("offers tomorrow, three days and the next weekend", () => {
    expect(snoozeOptions(TODAY).map((option) => [option.label, option.request])).toEqual([
      ["Morgen", { days: 1 }],
      ["In 3 Tagen", { days: 3 }],
      ["Nächstes Wochenende (Sa., 3. Okt.)", { until: "2026-10-03" }],
    ]);
  });

  it("moves to the following weekend on Saturdays and Sundays", () => {
    expect(nextWeekend("2026-10-03")).toBe("2026-10-10");
    expect(nextWeekend("2026-10-04")).toBe("2026-10-10");
    expect(nextWeekend("2026-12-28")).toBe("2027-01-02");
  });

  it("computes the target date", () => {
    expect(snoozeTarget({ days: 3 }, "2026-12-30")).toBe("2027-01-02");
    expect(snoozeTarget({ until: "2026-10-09" }, TODAY)).toBe("2026-10-09");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("Snooze on the dashboard", () => {
  it("snoozes by a quick option and confirms", async () => {
    const fetchMock = mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /household": ok({ timezone: "Europe/Berlin" }),
      "POST /tenners/t-1/snooze": ok(snoozed("2026-10-05")),
    });
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ verschieben" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "In 3 Tagen" }));

    expect(await screen.findByText("⏰ „Büro saugen“ auf Mo., 5. Okt. verschoben.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "POST /tenners/t-1/snooze")?.body).toEqual({ days: 3 });
  });

  it("snoozes to a picked date", async () => {
    const fetchMock = mockFetch({
      "GET /dashboard": ok(dashboard()),
      "POST /tenners/t-1/snooze": ok(snoozed("2026-10-09")),
    });
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ verschieben" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Datum wählen …" }));
    const dialog = await screen.findByRole("dialog", { name: "„Büro saugen“ verschieben" });
    const input = within(dialog).getByLabelText(/Neues Fälligkeitsdatum/);
    expect(input).toHaveValue("2026-10-03");
    fireEvent.change(input, { target: { value: "2026-10-09" } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Verschieben" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock.calls().find((call) => call.key === "POST /tenners/t-1/snooze")?.body).toEqual({
      until: "2026-10-09",
    });
  });

  it("disables dates that are not in the future", async () => {
    mockFetch({ "GET /dashboard": ok(dashboard()) });
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ verschieben" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Datum wählen …" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Neues Fälligkeitsdatum/), { target: { value: TODAY } });
    expect(within(dialog).getByRole("button", { name: "Verschieben" })).toBeDisabled();
  });

  it("shows the server's reason when snoozing fails", async () => {
    mockFetch({
      "GET /dashboard": ok(dashboard()),
      "POST /tenners/t-1/snooze": fail(409, "TENNER_INACTIVE", "Inactive Tenners cannot be snoozed."),
    });
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ verschieben" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Morgen" }));
    expect(await screen.findByText(/^Verschieben fehlgeschlagen\./)).toBeInTheDocument();
  });

  it("shows a badge for snoozed Tenners until the snooze date has passed", async () => {
    mockFetch({
      "GET /dashboard": ok(
        dashboard({
          dueToday: [dashboardTenner({ nextDue: TODAY, snoozedUntil: TODAY })],
          upcoming: [
            dashboardTenner({
              tennerId: "t-3",
              title: "Auto waschen",
              nextDue: "2026-10-05",
              snoozedUntil: "2026-10-05",
              daysUntilDue: 3,
            }),
          ],
          overdue: [
            dashboardTenner({
              tennerId: "t-2",
              title: "Alt",
              nextDue: "2026-09-30",
              snoozedUntil: "2026-09-30",
              overdueDays: 2,
            }),
          ],
        }),
      ),
    });
    renderWithProviders(<DashboardPage />);
    await screen.findByRole("heading", { level: 1, name: "Heute" });
    expect(dueToday().getByText("Verschoben bis Fr., 2. Okt.")).toBeInTheDocument();
    // The passed snooze of the overdue Aufgabe shows no badge; upcoming Aufgaben are not on the dashboard (UI-001).
    expect(dueToday().getAllByText(/Verschoben bis/)).toHaveLength(1);
    expect(screen.queryByText("Auto waschen")).not.toBeInTheDocument();
  });
});

describe("Snooze on the detail page", () => {
  const noop = () => undefined;

  it("is offered for due and overdue Tenners only", () => {
    mockFetch({});
    const { unmount } = renderWithProviders(
      <TennerDetailHeader
        tenner={tenner({ nextDue: "2026-09-30" })}
        busy={false}
        onEdit={noop}
        onArchive={noop}
        onRestore={noop}
        onPause={noop}
        onResume={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "„Büro saugen“ verschieben" })).toHaveTextContent("Verschieben");
    unmount();
    renderWithProviders(
      <TennerDetailHeader
        tenner={tenner({ nextDue: "2026-10-09", snoozedUntil: "2026-10-09" })}
        busy={false}
        onEdit={noop}
        onArchive={noop}
        onRestore={noop}
        onPause={noop}
        onResume={noop}
      />,
    );
    expect(screen.queryByRole("button", { name: /verschieben/ })).not.toBeInTheDocument();
    expect(screen.getByText("Verschoben bis Fr., 9. Okt.")).toBeInTheDocument();
  });
});
