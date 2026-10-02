import { act, screen, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/client";
import { fail, mockFetch, ok } from "../tests/fetchMock";
import { renderWithProviders } from "../tests/render";
import { z } from "zod";
import { ConnectivityBanner } from "./ConnectivityBanner";

const OFFLINE = "Keine Internetverbindung. Tenner aktualisiert sich, sobald du wieder online bist.";
const UNREACHABLE = "Tenner ist nicht erreichbar. Neuer Versuch läuft…";

function Probe() {
  const query = useQuery({
    queryKey: ["probe"],
    queryFn: () => apiClient.get("/probe", { schema: z.object({ ok: z.boolean() }) }),
  });
  return <button onClick={() => void query.refetch()}>Laden</button>;
}

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  });
}

describe("ConnectivityBanner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows an offline banner and hides it when back online", async () => {
    renderWithProviders(<ConnectivityBanner />);
    expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
    setOnline(false);
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
    setOnline(true);
    await waitFor(() => expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument());
  });

  it("shows that the API is unreachable after a transient read failure until a read succeeds", async () => {
    let calls = 0;
    mockFetch({ "GET /probe": () => (++calls === 1 ? fail(503, "SERVICE_UNAVAILABLE") : ok({ ok: true })) });
    renderWithProviders(
      <>
        <ConnectivityBanner />
        <Probe />
      </>,
    );
    expect(await screen.findByText(UNREACHABLE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Laden" }));
    await waitFor(() => expect(screen.queryByText(UNREACHABLE)).not.toBeInTheDocument());
  });

  it("ignores client errors such as 404", async () => {
    mockFetch({ "GET /probe": fail(404, "NOT_FOUND") });
    renderWithProviders(
      <>
        <ConnectivityBanner />
        <Probe />
      </>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Laden" })).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(UNREACHABLE)).not.toBeInTheDocument();
  });
});
