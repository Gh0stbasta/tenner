import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fail, mockFetch, ok, type MockResponse } from "../../tests/fetchMock";
import { completeResponse, dashboard, tenner } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { DashboardPage } from "../dashboard/DashboardPage";
import { TennersPage } from "../tenners/TennersPage";
import { useCompletion, UNDO_WINDOW_MS } from "./CompletionProvider";
import { CURRENT_USER_STORAGE_KEY } from "./CurrentUserProvider";

const undoResponse = ok({
  tenner: tenner(),
  revertedCompletion: { completionId: "c-1", revertedAt: "2026-10-02T08:01:00Z", revertedBy: "STEFAN" },
});

function deferred() {
  let resolve: (response: MockResponse) => void = () => undefined;
  const promise = new Promise<MockResponse>((r) => (resolve = r));
  return { promise, resolve };
}

const completeButton = (title: string) => screen.findByRole("button", { name: `„${title}“ erledigen` });

describe("completion and undo", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));
  afterEach(() => window.localStorage.clear());

  it("removes the Tenner optimistically before the API answers", async () => {
    const pending = deferred();
    mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /history": ok({ items: [], nextCursor: null }),
      "POST /tenners/t-1/complete": () => pending.promise,
    });
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await completeButton("Büro saugen"));

    await waitFor(() => expect(screen.queryByRole("region", { name: /^Heute fällig/ })).not.toBeInTheDocument());
    expect(
      within(screen.getByRole("region", { name: "Übersicht" })).getByText("Minuten offen").nextSibling,
    ).toHaveTextContent("15");
    pending.resolve(ok(completeResponse()));
    expect(await screen.findByText("✅ „Büro saugen“ erledigt.")).toBeInTheDocument();
  });

  it("offers undo for 10 seconds and reverts the completion", async () => {
    const fetchMock = mockFetch({
      "GET /dashboard": ok(dashboard()),
      "GET /history": ok({ items: [], nextCursor: null }),
      "POST /tenners/t-1/complete": ok(completeResponse()),
      "POST /tenners/t-1/undo-completion": undoResponse,
    });
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await completeButton("Büro saugen"));
    await userEvent.click(await screen.findByRole("button", { name: "Rückgängig" }));

    expect(await screen.findByText("↩ Erledigung zurückgenommen.")).toBeInTheDocument();
    const undo = fetchMock.calls().find((call) => call.key === "POST /tenners/t-1/undo-completion");
    expect(undo?.body).toEqual({ revertedBy: "STEFAN" });
    expect(undo?.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(UNDO_WINDOW_MS).toBe(10_000);
  });

  it("retries a failed undo with the same Idempotency-Key", async () => {
    let attempts = 0;
    const fetchMock = mockFetch({
      "GET /tenners": ok([tenner()]),
      "POST /tenners/t-1/complete": ok(completeResponse()),
      "POST /tenners/t-1/undo-completion": () => (++attempts === 1 ? fail(503, "SERVICE_UNAVAILABLE") : undoResponse),
    });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await completeButton("Büro saugen"));
    await userEvent.click(await screen.findByRole("button", { name: "Rückgängig" }));
    expect(
      await screen.findByText(
        "Rückgängig machen fehlgeschlagen. Tenner ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("↩ Erledigung zurückgenommen.")).toBeInTheDocument();

    const keys = fetchMock
      .calls()
      .filter((call) => call.key === "POST /tenners/t-1/undo-completion")
      .map((call) => call.headers["Idempotency-Key"]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("retries a failed completion with the same Idempotency-Key", async () => {
    let attempts = 0;
    const fetchMock = mockFetch({
      "GET /tenners": ok([tenner()]),
      "POST /tenners/t-1/complete": () =>
        ++attempts === 1 ? fail(503, "SERVICE_UNAVAILABLE") : ok(completeResponse()),
    });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await completeButton("Büro saugen"));
    expect(
      await screen.findByText(
        "„Büro saugen“ konnte nicht erledigt werden. Tenner ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("✅ „Büro saugen“ erledigt.")).toBeInTheDocument();

    const keys = fetchMock
      .calls()
      .filter((call) => call.key === "POST /tenners/t-1/complete")
      .map((call) => call.headers["Idempotency-Key"]);
    expect(keys[0]).toBe(keys[1]);
  });

  it("records the selected user as completedBy", async () => {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, "JULIA");
    const fetchMock = mockFetch({
      "GET /tenners": ok([tenner()]),
      "POST /tenners/t-1/complete": ok(completeResponse()),
    });
    renderWithProviders(<TennersPage />);
    await userEvent.click(await completeButton("Büro saugen"));
    await waitFor(() =>
      expect(fetchMock.calls().find((c) => c.key === "POST /tenners/t-1/complete")?.body).toEqual({
        completedBy: "JULIA",
        actualMinutes: 10,
      }),
    );
  });

  it("disables the button while completing", async () => {
    const pending = deferred();
    mockFetch({ "GET /tenners": ok([tenner()]), "POST /tenners/t-1/complete": () => pending.promise });
    renderWithProviders(<TennersPage />);
    const button = await completeButton("Büro saugen");
    await userEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    pending.resolve(ok(completeResponse()));
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("requires the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Consumer() {
      useCompletion();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow("useCompletion must be used inside CompletionProvider.");
  });
});
