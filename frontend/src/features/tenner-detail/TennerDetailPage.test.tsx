import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail, mockFetch, ok, type FetchMock } from "../../tests/fetchMock";
import { completeResponse, tenner } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { TennerDetailPage } from "./TennerDetailPage";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const entry = (id: string, days: number, completedBy = "STEFAN") => ({
  completionId: id,
  tennerId: "t-1",
  tennerTitle: "Büro saugen",
  completedBy,
  completedAt: daysAgo(days),
  actualMinutes: 12,
  revertedAt: null,
});

const TENNER = tenner({ lastCompleted: daysAgo(1), frequencyDays: 14 });
const PAGE_1 = { items: [entry("c-3", 1), entry("c-2", 15, "JULIA")], nextCursor: "cursor-2" };
const PAGE_2 = { items: [entry("c-1", 29)], nextCursor: null };

function historyHandler({ url }: { url: URL }) {
  return ok(url.searchParams.get("cursor") === "cursor-2" ? PAGE_2 : PAGE_1);
}

function renderDetail(handlers: Parameters<typeof mockFetch>[0], route = "/tenners/t-1") {
  const fetchMock = mockFetch(handlers);
  const result = renderWithProviders(
    <Routes>
      <Route path="/tenners" element={<p>Aufgabenliste</p>} />
      <Route path="/tenners/:tennerId" element={<TennerDetailPage />} />
    </Routes>,
    { route },
  );
  return { fetchMock, ...result };
}

const historyCalls = (fetchMock: FetchMock) =>
  fetchMock.calls().filter((call) => call.key.startsWith("GET /tenners/t-1/history"));

describe("TennerDetailPage", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));

  it("shows header, schedule, consistency and history newest first", async () => {
    const { fetchMock } = renderDetail({ "GET /tenners/t-1": ok(TENNER), "GET /tenners/t-1/history": historyHandler });

    expect(screen.getByRole("status", { name: "Aufgabe wird geladen" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Büro saugen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alle Aufgaben" })).toHaveAttribute("href", "/tenners");
    expect(fetchMock.calls()[0]?.key).toBe("GET /tenners/t-1?includeDeleted=true");

    const schedule = screen.getByRole("region", { name: "Zeitplan" });
    expect(within(schedule).getByText("Alle 14 Tage")).toBeInTheDocument();
    expect(within(schedule).getByText(/\(gestern\)$/)).toBeInTheDocument();
    expect(within(schedule).getByText("10 Min.")).toBeInTheDocument();

    const history = await screen.findByRole("list", { name: "Erledigungen" });
    const rows = within(history).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Stefan · 12 Min.");
    expect(rows[1]).toHaveTextContent("Julia · 12 Min.");

    const consistency = screen.getByRole("region", { name: "Regelmäßigkeit" });
    expect(within(consistency).getByText("2 Erledigungen in den letzten 90 Tagen")).toBeInTheDocument();
    expect(within(consistency).getByText("Ø alle 14 Tage (geplant: alle 14 Tage)")).toBeInTheDocument();
  });

  it("loads more history with the cursor", async () => {
    const { fetchMock } = renderDetail({ "GET /tenners/t-1": ok(TENNER), "GET /tenners/t-1/history": historyHandler });
    await userEvent.click(await screen.findByRole("button", { name: "Mehr anzeigen" }));
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Erledigungen" })).getAllByRole("listitem")).toHaveLength(3),
    );
    expect(historyCalls(fetchMock).map((call) => call.key)).toEqual([
      "GET /tenners/t-1/history?limit=20",
      "GET /tenners/t-1/history?limit=20&cursor=cursor-2",
    ]);
    expect(screen.queryByRole("button", { name: "Mehr anzeigen" })).not.toBeInTheDocument();
  });

  it("shows an empty history", async () => {
    renderDetail({ "GET /tenners/t-1": ok(tenner()), "GET /tenners/t-1/history": ok({ items: [], nextCursor: null }) });
    expect(await screen.findByText("Noch nicht erledigt.")).toBeInTheDocument();
    expect(screen.getByText("Für einen Durchschnitt braucht es mindestens zwei Erledigungen.")).toBeInTheDocument();
    expect(screen.getByText(/Noch nie/)).toBeInTheDocument();
  });

  it("shows a not-found page for unknown Tenners", async () => {
    renderDetail({ "GET /tenners/t-1": fail(404, "NOT_FOUND") });
    expect(await screen.findByText("Aufgabe nicht gefunden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zu allen Aufgaben" })).toHaveAttribute("href", "/tenners");
  });

  it("offers retry for network errors in tenner and history", async () => {
    let tennerCalls = 0;
    let historyCount = 0;
    renderDetail({
      "GET /tenners/t-1": () => (++tennerCalls === 1 ? fail(503, "SERVICE_UNAVAILABLE") : ok(TENNER)),
      "GET /tenners/t-1/history": (request) =>
        ++historyCount === 1 ? fail(503, "SERVICE_UNAVAILABLE") : historyHandler(request),
    });
    expect(await screen.findByText("Aufgabe konnte nicht geladen werden")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Büro saugen" })).toBeInTheDocument();
    expect(await screen.findByText("Verlauf konnte nicht geladen werden")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("list", { name: "Erledigungen" })).toBeInTheDocument();
  });

  it("refreshes tenner and history after completing and after undo", async () => {
    const { fetchMock } = renderDetail({
      "GET /tenners/t-1": ok(TENNER),
      "GET /tenners/t-1/history": historyHandler,
      "POST /tenners/t-1/complete": ok(completeResponse()),
      "POST /tenners/t-1/undo-completion": ok({
        tenner: TENNER,
        revertedCompletion: { completionId: "c-9", revertedAt: daysAgo(0), revertedBy: "STEFAN" },
      }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ erledigen" }));
    await waitFor(() => expect(historyCalls(fetchMock)).toHaveLength(2));
    await userEvent.click(await screen.findByRole("button", { name: "Rückgängig" }));
    await waitFor(() => expect(historyCalls(fetchMock)).toHaveLength(3));
    expect(fetchMock.calls().filter((call) => call.key.startsWith("GET /tenners/t-1?")).length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("opens the edit dialog", async () => {
    renderDetail({ "GET /tenners/t-1": ok(TENNER), "GET /tenners/t-1/history": historyHandler });
    await userEvent.click(await screen.findByRole("button", { name: "Bearbeiten" }));
    expect(screen.getByRole("dialog", { name: "Aufgabe bearbeiten" })).toBeInTheDocument();
  });

  it("archives after confirmation and returns to the list", async () => {
    const { fetchMock } = renderDetail({
      "GET /tenners/t-1": ok(TENNER),
      "GET /tenners/t-1/history": historyHandler,
      "DELETE /tenners/t-1": ok({ tennerId: "t-1", deleted: true }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Archivieren" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Aufgabe archivieren?" })).getByRole("button", { name: "Archivieren" }),
    );
    expect(await screen.findByText("Aufgabenliste")).toBeInTheDocument();
    expect(fetchMock.calls().some((call) => call.key === "DELETE /tenners/t-1")).toBe(true);
  });

  it("offers restore for archived Tenners", async () => {
    const { fetchMock } = renderDetail({
      "GET /tenners/t-1": ok(tenner({ active: false, deletedAt: daysAgo(3) })),
      "GET /tenners/t-1/history": historyHandler,
      "POST /tenners/t-1/restore": ok({ tennerId: "t-1", active: true, deletedAt: null }),
    });
    expect(await screen.findByText("Archiviert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "„Büro saugen“ erledigen" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Wiederherstellen" }));
    await waitFor(() => expect(fetchMock.calls().some((call) => call.key === "POST /tenners/t-1/restore")).toBe(true));
  });
});
