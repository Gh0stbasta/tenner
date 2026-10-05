import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DEFAULT_MEMBERS, fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { AlexaSettings } from "./AlexaSettings";

const context = (speakers: { personId: string; userId: string }[]) => ({ account: { userId: "STEFAN" }, members: DEFAULT_MEMBERS, speakers });

describe("AlexaSettings (ALEXA-002)", () => {
  it("lists mapped voices with member names and numbers several voices of one member", async () => {
    mockFetch({
      "GET /household/alexa": ok(
        context([
          { personId: "amzn1.ask.person.A", userId: "JULIA" },
          { personId: "amzn1.ask.person.B", userId: "STEFAN" },
          { personId: "amzn1.ask.person.C", userId: "JULIA" },
        ]),
      ),
    });
    renderWithProviders(<AlexaSettings />);
    expect(await screen.findByText("Stimme 1 von Julia")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Alexa-Stimmen" });
    expect(within(list).getByText("Stimme von Stefan")).toBeInTheDocument();
    expect(within(list).getByText("Stimme 2 von Julia")).toBeInTheDocument();
    expect(screen.queryByText(/amzn1/)).not.toBeInTheDocument();
  });

  it("removes a mapping (Speaker Mapping Delete)", async () => {
    const fetchMock = mockFetch({
      "GET /household/alexa": ok(context([{ personId: "amzn1.ask.person.A", userId: "JULIA" }])),
      "DELETE /household/alexa-speakers/amzn1.ask.person.A": ok(context([])),
    });
    renderWithProviders(<AlexaSettings />);
    await userEvent.click(await screen.findByRole("button", { name: "Zuordnung entfernen: Stimme von Julia" }));
    expect(await screen.findByText("Noch keine Stimmen zugeordnet.")).toBeInTheDocument();
    expect(fetchMock.calls().map((call) => call.key)).toContain("DELETE /household/alexa-speakers/amzn1.ask.person.A");
    expect(await screen.findByText(/Alexa fragt beim nächsten Mal wieder nach/)).toBeInTheDocument();
  });

  it("shows the empty state and load errors", async () => {
    mockFetch({ "GET /household/alexa": fail(503, "SERVICE_UNAVAILABLE") });
    renderWithProviders(<AlexaSettings />);
    expect(await screen.findByText(/Alexa-Zuordnungen konnten nicht geladen werden/)).toBeInTheDocument();
  });

  it("reports a failed removal", async () => {
    mockFetch({
      "GET /household/alexa": ok(context([{ personId: "amzn1.ask.person.A", userId: "JULIA" }])),
      "DELETE /household/alexa-speakers/amzn1.ask.person.A": fail(404, "NOT_FOUND", "Speaker mapping not found."),
    });
    renderWithProviders(<AlexaSettings />);
    await userEvent.click(await screen.findByRole("button", { name: /Zuordnung entfernen/ }));
    expect(await screen.findByText(/Entfernen fehlgeschlagen/)).toBeInTheDocument();
  });
});
