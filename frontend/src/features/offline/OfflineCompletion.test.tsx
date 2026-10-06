import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { completeResponse, dashboard, tenner } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { DashboardPage } from "../dashboard/DashboardPage";
import { TennersPage } from "../tenners/TennersPage";
import { OFFLINE_QUEUE_KEY, type QueuedCompletion } from "./completionQueue";
import { PendingSyncIndicator } from "./PendingSyncIndicator";

const QUEUED: QueuedCompletion = {
  tennerId: "t-1",
  title: "Büro saugen",
  completedBy: "STEFAN",
  completedAt: "2026-10-06T06:00:00.000Z",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
};

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  });
}

function renderDashboard() {
  return renderWithProviders(
    <>
      <PendingSyncIndicator />
      <DashboardPage />
    </>,
  );
}

const completeButton = () => screen.findByRole("button", { name: "„Büro saugen“ erledigen" });
const completeCalls = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.calls().filter((call) => call.key === "POST /tenners/t-1/complete");

describe("offline completion (MOBILE-004)", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));
  // TanStack's online state is global: every test starts online.
  afterEach(() => onlineManager.setOnline(true));

  it("queues a completion offline and transfers it with time and key when back online", async () => {
    const fetchMock = mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /history": ok({ items: [], nextCursor: null }),
      "POST /tenners/t-1/complete": ok(completeResponse()),
    });
    renderDashboard();
    const button = await completeButton();
    setOnline(false);
    await userEvent.click(button);

    expect(
      await screen.findByText("📴 „Büro saugen“ offline erledigt. Wird übertragen, sobald du online bist."),
    ).toBeInTheDocument();
    expect(screen.getByText("⏳ 1 Offline-Erledigung wartet auf die Übertragung: „Büro saugen“.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "„Büro saugen“ erledigen" })).not.toBeInTheDocument();
    expect(completeCalls(fetchMock)).toHaveLength(0);
    const stored = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? "[]") as QueuedCompletion[];
    expect(stored).toHaveLength(1);

    setOnline(true);
    expect(await screen.findByText("✅ Offline-Erledigung „Büro saugen“ übertragen.")).toBeInTheDocument();
    const [call] = completeCalls(fetchMock);
    expect(call?.body).toEqual({ completedBy: "STEFAN", completedAt: stored[0]?.completedAt });
    expect(call?.headers["Idempotency-Key"]).toBe(stored[0]?.idempotencyKey);
    expect(screen.queryByText(/wartet auf die Übertragung/)).not.toBeInTheDocument();
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });

  it("undo takes an offline completion out of the queue and shows the Tenner again", async () => {
    mockFetch({ "GET /dashboard": ok(dashboard()), "GET /history": ok({ items: [], nextCursor: null }) });
    renderDashboard();
    const button = await completeButton();
    setOnline(false);
    await userEvent.click(button);
    await userEvent.click(await screen.findByRole("button", { name: "Rückgängig" }));
    expect(await completeButton()).toBeInTheDocument();
    expect(screen.queryByText(/wartet auf die Übertragung/)).not.toBeInTheDocument();
    expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull();
  });

  it("does not queue the same Tenner twice", async () => {
    // The server is down, so the queued completion stays; the list page still offers the Tenner.
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([QUEUED]));
    mockFetch({
      "GET /tenners": ok([tenner()]),
      "POST /tenners/t-1/complete": fail(503, "SERVICE_UNAVAILABLE"),
    });
    renderWithProviders(<TennersPage />);
    const button = await completeButton();
    setOnline(false);
    await userEvent.click(button);
    expect(await screen.findByText("„Büro saugen“ ist schon zum Übertragen vorgemerkt.")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? "[]")).toHaveLength(1);
  });

  it("queues instead of failing when the connection drops during the request", async () => {
    const fetchMock = mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /history": ok({ items: [], nextCursor: null }),
      "POST /tenners/t-1/complete": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    renderDashboard();
    await userEvent.click(await completeButton());
    expect(await screen.findByText(/offline erledigt/)).toBeInTheDocument();
    expect(screen.getByText(/1 Offline-Erledigung wartet/)).toBeInTheDocument();
    expect(screen.queryByText(/konnte nicht erledigt werden/)).not.toBeInTheDocument();
    expect(completeCalls(fetchMock).length).toBeGreaterThan(0);
  });

  it("keeps a queued Tenner hidden on the dashboard until it is transferred", async () => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([QUEUED]));
    mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /history": ok({ items: [], nextCursor: null }),
      "POST /tenners/t-1/complete": fail(503, "SERVICE_UNAVAILABLE"),
    });
    renderDashboard();
    expect(await screen.findByText(/1 Offline-Erledigung wartet/)).toBeInTheDocument();
    await screen.findByRole("region", { name: "Übersicht" });
    expect(screen.queryByRole("button", { name: "„Büro saugen“ erledigen" })).not.toBeInTheDocument();
  });

  it("transfers a queue left from an earlier session and reports what the server refused", async () => {
    localStorage.setItem(
      OFFLINE_QUEUE_KEY,
      JSON.stringify([QUEUED, { ...QUEUED, tennerId: "t-9", title: "Fenster", idempotencyKey: "k-9" }]),
    );
    const fetchMock = mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /history": ok({ items: [], nextCursor: null }),
      "POST /tenners/t-1/complete": ok(completeResponse()),
      "POST /tenners/t-9/complete": fail(409, "TENNER_INACTIVE"),
    });
    renderDashboard();
    expect(
      await screen.findByText(
        "✅ Offline-Erledigung „Büro saugen“ übertragen. „Fenster“ nicht übernommen: Der Tenner wurde inzwischen gelöscht oder archiviert.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(OFFLINE_QUEUE_KEY)).toBeNull());
    expect(completeCalls(fetchMock)).toHaveLength(1);
  });

  it("summarizes several transferred completions", async () => {
    localStorage.setItem(
      OFFLINE_QUEUE_KEY,
      JSON.stringify([QUEUED, { ...QUEUED, tennerId: "t-9", title: "Fenster", idempotencyKey: "k-9" }]),
    );
    mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /history": ok({ items: [], nextCursor: null }),
      "POST /tenners/t-1/complete": ok(completeResponse()),
      "POST /tenners/t-9/complete": ok(completeResponse()),
    });
    renderDashboard();
    expect(await screen.findByText("✅ 2 Offline-Erledigungen übertragen.")).toBeInTheDocument();
  });
});
