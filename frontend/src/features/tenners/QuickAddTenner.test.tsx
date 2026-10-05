import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../api/queryKeys";
import { fail, mockFetch, ok, type FetchMock } from "../../tests/fetchMock";
import { tenner } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { DEFAULT_PREFERENCES } from "../settings/preferences";
import { QuickAddTenner } from "./QuickAddTenner";

const input = () => screen.getByRole("textbox", { name: "Was soll ein Tenner werden?" });
const posts = (fetchMock: FetchMock) => fetchMock.calls().filter((call) => call.key === "POST /tenners");

function setup(
  existing = [tenner({ title: "Vacuum Office" })],
  createResponse = ok(tenner({ tennerId: "new", title: "Wash Car" }), 201),
) {
  const fetchMock = mockFetch({ "GET /tenners": ok(existing), "POST /tenners": createResponse });
  const result = renderWithProviders(<QuickAddTenner />);
  return { fetchMock, ...result };
}

describe("QuickAddTenner", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));

  it("renders the input and the add button", () => {
    setup();
    expect(input()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hinzufügen" })).toBeInTheDocument();
  });

  it("creates a Tenner with the defaults on Enter, clears the input and refreshes", async () => {
    const { fetchMock, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await userEvent.type(input(), "Wash Car{Enter}");

    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
    expect(posts(fetchMock)[0]?.body).toEqual({
      title: "Wash Car",
      category: "HOUSEHOLD",
      assignedTo: "STEFAN",
      estimatedMinutes: 10,
      frequencyDays: 14,
    });
    await waitFor(() => expect(input()).toHaveValue(""));
    expect(await screen.findByText("✅ „Wash Car“ angelegt.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.tenners });
  });

  it("creates through the button and uses the suggested category", async () => {
    const { fetchMock } = setup();
    await userEvent.type(input(), "Long Zwift Ride");
    expect(screen.getByText("Fitness (vorgeschlagen) · 10 Min. · alle 14 Tage – später änderbar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    await waitFor(() =>
      expect(posts(fetchMock)[0]?.body).toMatchObject({ title: "Long Zwift Ride", category: "FITNESS" }),
    );
  });

  it("validates the title before calling the API", async () => {
    const { fetchMock } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(screen.getByText("Titel ist erforderlich.")).toBeInTheDocument();
    await userEvent.type(input(), "ab{Enter}");
    expect(screen.getByText("Der Titel braucht mindestens 3 Zeichen.")).toBeInTheDocument();
    await userEvent.type(input(), "c");
    expect(screen.queryByText("Der Titel braucht mindestens 3 Zeichen.")).not.toBeInTheDocument();
    expect(fetchMock.calls().filter((call) => !call.key.startsWith("GET "))).toHaveLength(0);
  });

  it("rejects titles longer than 100 characters", async () => {
    setup();
    await userEvent.type(input(), `${"x".repeat(101)}{Enter}`);
    expect(screen.getByText("Der Titel darf höchstens 100 Zeichen haben.")).toBeInTheDocument();
  });

  it("warns about a similar Tenner and creates only after confirmation", async () => {
    const { fetchMock } = setup();
    await userEvent.type(input(), "vacuum office{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "Ähnlicher Tenner vorhanden" });
    expect(within(dialog).getByText("Es gibt bereits einen ähnlichen Tenner: „Vacuum Office“.")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(posts(fetchMock)).toHaveLength(0);
    const field = await screen.findByRole("textbox", { name: "Was soll ein Tenner werden?" });
    expect(field).toHaveValue("vacuum office");

    await userEvent.type(field, "{Enter}");
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Trotzdem anlegen" }));
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
  });

  it("keeps the input and shows an error when the API fails", async () => {
    setup([], fail(500, "INTERNAL_ERROR"));
    await userEvent.type(input(), "Wash Car{Enter}");
    expect(
      await screen.findByText(
        "Tenner konnte nicht angelegt werden. Tenner ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
      ),
    ).toBeInTheDocument();
    expect(input()).toHaveValue("Wash Car");
  });

  it("still creates when the duplicate check cannot load the list", async () => {
    const fetchMock = mockFetch({
      "GET /tenners": fail(500, "INTERNAL_ERROR"),
      "POST /tenners": ok(tenner({ title: "Wash Car" }), 201),
    });
    renderWithProviders(<QuickAddTenner />);
    await userEvent.type(input(), "Wash Car{Enter}");
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
  });

  it("uses the household defaults and the personal default assignee (HOUSEHOLD-ADMIN-003)", async () => {
    const fetchMock = mockFetch({
      "GET /tenners": ok([]),
      "GET /household": ok({
        timezone: "Europe/Berlin",
        defaults: { category: "FINANCE", estimatedMinutes: 25, frequencyDays: 30 },
        defaultsSource: "HOUSEHOLD",
      }),
      "POST /tenners": ok(tenner({ tennerId: "new", title: "Xylofon stimmen" }), 201),
    });
    renderWithProviders(<QuickAddTenner />, {
      user: "STEFAN",
      preferences: { ...DEFAULT_PREFERENCES, defaultAssignedTo: "JULIA" },
    });
    await userEvent.type(input(), "Xylofon stimmen");
    expect(await screen.findByText("Finanzen · 25 Min. · alle 30 Tage – später änderbar")).toBeInTheDocument();
    await userEvent.type(input(), "{Enter}");
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
    expect(posts(fetchMock)[0]?.body).toEqual({
      title: "Xylofon stimmen",
      category: "FINANCE",
      assignedTo: "JULIA",
      estimatedMinutes: 25,
      frequencyDays: 30,
    });
  });
});
