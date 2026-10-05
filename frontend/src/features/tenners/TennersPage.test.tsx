import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fail, mockFetch, ok, type FetchMock } from "../../tests/fetchMock";
import { completeResponse, tenner } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { todayIsoDate } from "../../utils/dates";
import { frequencyLabel } from "./status";
import { TennersPage } from "./TennersPage";

const today = todayIsoDate();
const ACTIVE = [
  tenner({ tennerId: "t-1", title: "Büro saugen", nextDue: today }),
  tenner({
    tennerId: "t-2",
    title: "Fenster putzen",
    assignedTo: "JULIA",
    category: "HOME",
    estimatedMinutes: 30,
    nextDue: "2020-01-01",
  }),
];
const INACTIVE = [tenner({ tennerId: "t-3", title: "Rad ölen", active: false, category: "FITNESS" })];
const ARCHIVED = [tenner({ tennerId: "t-4", title: "Alter Tenner", active: false, deletedAt: "2026-09-01T00:00:00Z" })];

function listHandler({ url }: { url: URL }) {
  if (url.searchParams.get("deleted") === "true") return ok(ARCHIVED);
  if (url.searchParams.get("active") === "false") return ok(INACTIVE);
  return ok(ACTIVE);
}

function listCalls(fetchMock: FetchMock): URLSearchParams[] {
  return fetchMock
    .calls()
    .filter((call) => call.key.startsWith("GET /tenners"))
    .map((call) => new URLSearchParams(call.key.split("?")[1] ?? ""));
}

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("TennersPage", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));
  afterEach(() => vi.useRealTimers());

  it("shows skeletons while loading, then cards with details and a summary", async () => {
    mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    expect(screen.getByRole("status", { name: "Tenner werden geladen" })).toBeInTheDocument();

    const list = await screen.findByRole("list", { name: "Tenner-Liste" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("2 aktive Tenner · 1 überfällig · 40 Min. geschätzt")).toBeInTheDocument();
    expect(within(list).getByText("Heute fällig")).toBeInTheDocument();
    expect(within(list).getByText(/überfällig$/)).toBeInTheDocument();
    expect(within(list).getAllByText(/^Alle 14 Tage · Fällig:/)).toHaveLength(2);
    expect(within(list).getByText("Julia · 30 Min.")).toBeInTheDocument();
  });

  it("links each title to its detail page", async () => {
    mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    expect(await screen.findByRole("link", { name: "Büro saugen" })).toHaveAttribute("href", "/tenners/t-1");
  });

  it("requests active Tenners sorted by due date by default", async () => {
    const fetchMock = mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    await screen.findByText("Büro saugen");
    expect(listCalls(fetchMock)[0]?.toString()).toBe("sort=nextDue&order=asc");
  });

  it("searches titles live (debounced)", async () => {
    mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    await screen.findByText("Büro saugen");
    await userEvent.type(screen.getByRole("searchbox", { name: "Suche" }), "fenster");
    await waitFor(() => expect(screen.queryByText("Büro saugen")).not.toBeInTheDocument());
    expect(screen.getByText("Fenster putzen")).toBeInTheDocument();
  });

  it("filters by user, category and sorting through the API", async () => {
    const fetchMock = mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    await screen.findByText("Büro saugen");

    await choose("Person", "Julia");
    await choose("Kategorie", "Haus & Garten");
    await choose("Sortierung", "Titel");
    await choose("Richtung", "Absteigend");

    await waitFor(() =>
      expect(listCalls(fetchMock).at(-1)?.toString()).toBe("assignedTo=JULIA&category=HOME&sort=title&order=desc"),
    );
    await choose("Person", "Alle");
    await waitFor(() => expect(listCalls(fetchMock).at(-1)?.has("assignedTo")).toBe(false));
  });

  it("shows archived Tenners with a restore action", async () => {
    const fetchMock = mockFetch({
      "GET /tenners": listHandler,
      "POST /tenners/t-4/restore": ok({ tennerId: "t-4", active: true, deletedAt: null }),
    });
    renderWithProviders(<TennersPage />);
    await screen.findByText("Büro saugen");
    await choose("Status", "Archiviert");

    expect(await screen.findByText("Alter Tenner")).toBeInTheDocument();
    expect(listCalls(fetchMock).at(-1)?.get("deleted")).toBe("true");
    expect(screen.queryByRole("button", { name: "„Alter Tenner“ archivieren" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "„Alter Tenner“ wiederherstellen" }));
    await waitFor(() => expect(fetchMock.calls().some((c) => c.key === "POST /tenners/t-4/restore")).toBe(true));
    expect(fetchMock.calls().find((c) => c.key === "POST /tenners/t-4/restore")?.body).toEqual({
      restoredBy: "STEFAN",
    });
  });

  it("combines active, inactive and archived Tenners for status 'all'", async () => {
    const fetchMock = mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    await screen.findByText("Büro saugen");
    await choose("Status", "Alle");

    expect(await screen.findByText("Rad ölen")).toBeInTheDocument();
    expect(screen.getByText("Alter Tenner")).toBeInTheDocument();
    expect(screen.getByText("Inaktiv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "„Rad ölen“ erledigen" })).toBeDisabled();
    expect(listCalls(fetchMock).length).toBe(4);
  });

  it("shows an empty state when nothing matches", async () => {
    mockFetch({ "GET /tenners": ok([]) });
    renderWithProviders(<TennersPage />);
    expect(await screen.findByText("Keine Tenner gefunden")).toBeInTheDocument();
    expect(screen.getByText("Passe die Filter an oder lege deinen ersten Tenner an.")).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    let calls = 0;
    mockFetch({ "GET /tenners": () => (++calls === 1 ? fail(500, "INTERNAL_ERROR") : ok(ACTIVE)) });
    renderWithProviders(<TennersPage />);
    expect(await screen.findByText("Tenner konnten nicht geladen werden")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Büro saugen")).toBeInTheDocument();
  });

  it("completes a Tenner and refreshes the list", async () => {
    let listCallsCount = 0;
    const fetchMock = mockFetch({
      "GET /tenners": (request) => {
        listCallsCount++;
        return listHandler(request);
      },
      "POST /tenners/t-1/complete": ok(completeResponse()),
    });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ erledigen" }));
    await waitFor(() => expect(listCallsCount).toBe(2));
    expect(fetchMock.calls().find((c) => c.key === "POST /tenners/t-1/complete")?.body).toEqual({
      completedBy: "STEFAN",
    });
  });

  it("archives a Tenner only after confirmation", async () => {
    const fetchMock = mockFetch({
      "GET /tenners": listHandler,
      "DELETE /tenners/t-2": ok({ tennerId: "t-2", deleted: true }),
    });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Fenster putzen“ archivieren" }));

    const dialog = screen.getByRole("dialog", { name: "Tenner archivieren?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(fetchMock.calls().some((c) => c.key === "DELETE /tenners/t-2")).toBe(false);

    await userEvent.click(await screen.findByRole("button", { name: "„Fenster putzen“ archivieren" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Archivieren" }));
    await waitFor(() => expect(fetchMock.calls().some((c) => c.key === "DELETE /tenners/t-2")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows an alert when archiving fails", async () => {
    mockFetch({ "GET /tenners": listHandler, "DELETE /tenners/t-1": fail(409, "CONCURRENT_MODIFICATION") });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ archivieren" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Archivieren" }));
    expect(
      await screen.findByText(
        "Die Aktion ist fehlgeschlagen. Jemand anderes hat diesen Tenner geändert. Lade neu, um den aktuellen Stand zu sehen.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a snackbar when completing fails", async () => {
    mockFetch({ "GET /tenners": listHandler, "POST /tenners/t-1/complete": fail(409, "CONCURRENT_MODIFICATION") });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ erledigen" }));
    expect(
      await screen.findByText(
        "„Büro saugen“ konnte nicht erledigt werden. Jemand anderes hat diesen Tenner geändert. Lade neu, um den aktuellen Stand zu sehen.",
      ),
    ).toBeInTheDocument();
  });

  it("opens the edit dialog with the Tenner's values", async () => {
    mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ bearbeiten" }));
    expect(screen.getByRole("dialog", { name: "Tenner bearbeiten" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Titel" })).toHaveValue("Büro saugen");
  });

  it("opens the create dialog from the header", async () => {
    mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    await userEvent.click(screen.getByRole("button", { name: "Neuer Tenner" }));
    expect(screen.getByRole("dialog", { name: "Tenner anlegen" })).toBeInTheDocument();
  });

  it("collapses secondary actions into a menu on phones", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    mockFetch({ "GET /tenners": listHandler, "DELETE /tenners/t-1": ok({ tennerId: "t-1", deleted: true }) });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Weitere Aktionen für „Büro saugen“" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Bearbeiten" }));
    expect(screen.getByRole("dialog", { name: "Tenner bearbeiten" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await userEvent.click(await screen.findByRole("button", { name: "Weitere Aktionen für „Büro saugen“" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Archivieren" }));
    expect(screen.getByRole("dialog", { name: "Tenner archivieren?" })).toBeInTheDocument();
  });

  it("logs telemetry for filter changes", async () => {
    mockFetch({ "GET /tenners": listHandler });
    renderWithProviders(<TennersPage />);
    await screen.findByText("Büro saugen");
    await choose("Status", "Archiviert");
    expect(console.info).toHaveBeenCalledWith(
      "[telemetry] FilterChanged",
      expect.objectContaining({ status: "archived" }),
    );
  });
});

describe("frequencyLabel", () => {
  it.each([
    ["DAY", 1, "Täglich"],
    ["DAY", 7, "Wöchentlich"],
    ["DAY", 30, "Alle 30 Tage"],
    ["WEEK", 1, "Wöchentlich"],
    ["WEEK", 2, "Alle 2 Wochen"],
    ["MONTH", 1, "Monatlich"],
    ["MONTH", 3, "Vierteljährlich"],
    ["MONTH", 6, "Halbjährlich"],
    ["MONTH", 2, "Alle 2 Monate"],
    ["YEAR", 1, "Jährlich"],
    ["YEAR", 2, "Alle 2 Jahre"],
  ] as const)("labels %s × %i as %s (SCHEDULING-001)", (frequencyUnit, frequencyInterval, label) => {
    expect(frequencyLabel({ frequencyUnit, frequencyInterval })).toBe(label);
  });

  it("lists weekdays for weekday-bound frequencies (SCHEDULING-002)", () => {
    expect(frequencyLabel({ frequencyUnit: "WEEK", frequencyInterval: 1, weekdays: ["SAT"] })).toBe("Wöchentlich (Sa)");
    expect(frequencyLabel({ frequencyUnit: "WEEK", frequencyInterval: 1, weekdays: ["TUE", "FRI"] })).toBe(
      "Wöchentlich (Di, Fr)",
    );
    expect(frequencyLabel({ frequencyUnit: "WEEK", frequencyInterval: 2, weekdays: ["FRI"] })).toBe(
      "Alle 2 Wochen (Fr)",
    );
    expect(frequencyLabel({ frequencyUnit: "WEEK", frequencyInterval: 1, weekdays: null })).toBe("Wöchentlich");
  });
});
