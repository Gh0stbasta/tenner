/** HOUSEHOLD-001: rotating assignment in the frontend. */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tenner } from "../../tests/fixtures";
import { mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { CreateTennerDialog } from "../tenners/CreateTennerDialog";
import { EditTennerDialog } from "../tenners/EditTennerDialog";
import { TennersPage } from "../tenners/TennersPage";
import { nextInRotation } from "./rotation";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("rotating assignment", () => {
  it("computes the next member like the backend", () => {
    expect(nextInRotation(["STEFAN", "JULIA"], "JULIA", () => true)).toBe("STEFAN");
    expect(nextInRotation(["STEFAN", "JULIA", "LENA"], "STEFAN", (id) => id !== "JULIA")).toBe("LENA");
  });

  it("creates a rotating Tenner between two members", async () => {
    const fetchMock = mockFetch({ "POST /tenners": ok(tenner(), 201) });
    const onClose = vi.fn();
    renderWithProviders(<CreateTennerDialog open onClose={onClose} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Titel" }), "Bad putzen");
    await userEvent.click(screen.getByRole("switch", { name: "Abwechselnd zuständig" }));
    const rotation = within(screen.getByRole("group", { name: "Rotation" }));
    expect(await rotation.findByRole("button", { name: "Stefan" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Bitte mindestens zwei Personen auswählen.")).toBeInTheDocument();
    await userEvent.click(rotation.getByRole("button", { name: "Julia" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Aufgabe anlegen" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Aufgabe anlegen" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock.calls().find((call) => call.key === "POST /tenners")?.body).toMatchObject({
      assignedTo: "STEFAN",
      assignmentMode: "ROTATING",
      rotation: ["STEFAN", "JULIA"],
    });
  });

  it("turns a rotation off and sends the group of fields", async () => {
    const existing = tenner({ tennerId: "t-9", assignmentMode: "ROTATING", rotation: ["STEFAN", "JULIA"] });
    const fetchMock = mockFetch({ "PUT /tenners/t-9": ok({ ...existing, assignmentMode: "FIXED", rotation: null }) });
    const onClose = vi.fn();
    renderWithProviders(<EditTennerDialog tenner={existing} onClose={onClose} />);
    const toggle = screen.getByRole("switch", { name: "Abwechselnd zuständig" });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole("button", { name: "Änderungen speichern" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock.calls().find((call) => call.key === "PUT /tenners/t-9")?.body).toEqual({
      assignmentMode: "FIXED",
      rotation: null,
      assignedTo: "STEFAN",
    });
  });

  it("shows who is next in the list", async () => {
    mockFetch({
      "GET /tenners": ok([tenner({ assignmentMode: "ROTATING", rotation: ["STEFAN", "JULIA"], assignedTo: "STEFAN" })]),
    });
    renderWithProviders(<TennersPage />);
    expect(await screen.findByText(/Abwechselnd, danach Julia/)).toBeInTheDocument();
  });
});
