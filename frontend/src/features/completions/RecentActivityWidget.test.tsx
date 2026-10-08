import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { RecentActivityWidget } from "./RecentActivityWidget";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const ITEMS = [
  {
    completionId: "c-2",
    tennerId: "t-2",
    tennerTitle: "Haustür putzen",
    completedBy: "JULIA",
    completedAt: minutesAgo(2),
    actualMinutes: 15,
    revertedAt: null,
  },
  {
    completionId: "c-1",
    tennerId: "t-1",
    tennerTitle: null,
    completedBy: "STEFAN",
    completedAt: minutesAgo(90),
    actualMinutes: 10,
    revertedAt: null,
  },
];

describe("RecentActivityWidget", () => {
  it("lists the latest completions newest first with who and when", async () => {
    const fetchMock = mockFetch({ "GET /history": ok({ items: ITEMS, nextCursor: "next" }) });
    renderWithProviders(<RecentActivityWidget />);
    const list = await screen.findByRole("list", { name: "Letzte Erledigungen" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Haustür putzen");
    expect(rows[0]).toHaveTextContent("Erledigt von Julia · vor 2 Minuten");
    expect(rows[1]).toHaveTextContent("Gelöschte Aufgabe");
    expect(fetchMock.calls()[0]?.key).toBe("GET /history?limit=10");
  });

  it("shows an empty state", async () => {
    mockFetch({ "GET /history": ok({ items: [], nextCursor: null }) });
    renderWithProviders(<RecentActivityWidget />);
    expect(await screen.findByText("Noch nichts erledigt.")).toBeInTheDocument();
  });

  it("shows loading and errors with retry", async () => {
    let calls = 0;
    mockFetch({
      "GET /history": () => (++calls === 1 ? fail(500, "INTERNAL_ERROR") : ok({ items: ITEMS, nextCursor: null })),
    });
    renderWithProviders(<RecentActivityWidget />);
    expect(screen.getByRole("status", { name: "Aktivität wird geladen" })).toBeInTheDocument();
    expect(await screen.findByText("Aktivität nicht verfügbar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByText("Haustür putzen")).toBeInTheDocument();
  });
});
