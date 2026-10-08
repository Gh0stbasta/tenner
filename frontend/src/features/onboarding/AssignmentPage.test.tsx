import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { ASSIGNMENT_FAILED, AssignmentPage } from "./AssignmentPage";

const FREE = [
  { userId: "STEFAN", displayName: "Stefan", available: true },
  { userId: "JULIA", displayName: "Julia", available: true },
];

function renderPage(onAssigned = vi.fn(async () => undefined), onLogout = vi.fn()) {
  renderWithProviders(<AssignmentPage onAssigned={onAssigned} onLogout={onLogout} />, { withoutSession: true });
  return { onAssigned, onLogout };
}

describe("AssignmentPage", () => {
  it("first login: welcomes the user and offers Stefan and Julia", async () => {
    mockFetch({ "GET /onboarding": ok({ assignedTo: null, members: FREE }) });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Willkommen in der Zentrale" })).toBeInTheDocument();
    expect(screen.getByText(/noch keiner Person im Haushalt zugeordnet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ich bin Stefan" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ich bin Julia" })).toBeEnabled();
  });

  it.each(["STEFAN", "JULIA"] as const)("assigns %s and continues", async (userId) => {
    const fetchMock = mockFetch({
      "GET /onboarding": ok({ assignedTo: null, members: FREE }),
      "POST /onboarding/assignment": ok({ userId }, 201),
    });
    const { onAssigned } = renderPage();
    const name = userId === "STEFAN" ? "Stefan" : "Julia";
    await userEvent.click(await screen.findByRole("button", { name: `Ich bin ${name}` }));
    await waitFor(() => expect(onAssigned).toHaveBeenCalledOnce());
    expect(fetchMock.calls().find((call) => call.key === "POST /onboarding/assignment")?.body).toEqual({ userId });
  });

  it("existing assignment: skips onboarding automatically", async () => {
    mockFetch({ "GET /onboarding": ok({ assignedTo: "JULIA", members: FREE }) });
    const { onAssigned } = renderPage();
    await waitFor(() => expect(onAssigned).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { name: "Willkommen in der Zentrale" })).not.toBeInTheDocument();
  });

  it("shows taken members as unavailable", async () => {
    mockFetch({ "GET /onboarding": ok({ assignedTo: null, members: [FREE[0], { ...FREE[1], available: false }] }) });
    renderPage();
    expect(await screen.findByRole("button", { name: "Julia (bereits vergeben)" })).toBeDisabled();
    expect(screen.getByText("Bereits vergeben")).toBeInTheDocument();
  });

  it("assignment failure: shows the retry message and keeps the choice open", async () => {
    mockFetch({
      "GET /onboarding": ok({ assignedTo: null, members: FREE }),
      "POST /onboarding/assignment": fail(500, "PERSISTENCE_ERROR"),
    });
    const { onAssigned } = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ich bin Stefan" }));
    expect(await screen.findByText(ASSIGNMENT_FAILED)).toBeInTheDocument();
    expect(onAssigned).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ich bin Stefan" })).toBeEnabled();
  });

  it("member taken in the meantime: explains it", async () => {
    mockFetch({
      "GET /onboarding": ok({ assignedTo: null, members: FREE }),
      "POST /onboarding/assignment": fail(409, "MEMBER_TAKEN"),
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ich bin Julia" }));
    expect(await screen.findByText("Diese Person ist schon mit einem anderen Konto verknüpft.")).toBeInTheDocument();
  });

  it("already assigned in another tab: continues instead of failing", async () => {
    mockFetch({
      "GET /onboarding": ok({ assignedTo: null, members: FREE }),
      "POST /onboarding/assignment": fail(409, "ALREADY_ASSIGNED"),
    });
    const { onAssigned } = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Ich bin Julia" }));
    await waitFor(() => expect(onAssigned).toHaveBeenCalledOnce());
  });

  it("no free member: strangers cannot get in and can log out", async () => {
    mockFetch({ "GET /onboarding": ok({ assignedTo: null, members: FREE.map((m) => ({ ...m, available: false })) }) });
    const { onLogout } = renderPage();
    expect(await screen.findByText("Kein freier Platz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ich bin/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abmelden" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("session refresh fails after assignment: offers to continue again", async () => {
    mockFetch({
      "GET /onboarding": ok({ assignedTo: null, members: FREE }),
      "POST /onboarding/assignment": ok({ userId: "STEFAN" }, 201),
    });
    const onAssigned = vi.fn().mockRejectedValueOnce(new Error("refresh failed")).mockResolvedValueOnce(undefined);
    renderPage(onAssigned);
    await userEvent.click(await screen.findByRole("button", { name: "Ich bin Stefan" }));
    await userEvent.click(await screen.findByRole("button", { name: "Weiter" }));
    expect(onAssigned).toHaveBeenCalledTimes(2);
  });

  it("onboarding cannot be loaded: shows an error with retry", async () => {
    mockFetch({ "GET /onboarding": fail(503, "SERVICE_UNAVAILABLE") });
    renderPage();
    expect(await screen.findByText("Die Zentrale ist gerade nicht erreichbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /erneut/i })).toBeInTheDocument();
  });
});
