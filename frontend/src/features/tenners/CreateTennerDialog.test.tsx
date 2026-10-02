import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../api/queryKeys";
import { mockFetch, ok, type MockResponse } from "../../tests/fetchMock";
import { tenner } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { CreateTennerDialog } from "./CreateTennerDialog";

function renderDialog(onClose = vi.fn()) {
  const result = renderWithProviders(<CreateTennerDialog open onClose={onClose} />);
  return { ...result, onClose, dialog: screen.getByRole("dialog", { name: "Tenner anlegen" }) };
}

const submitButton = () => screen.getByRole("button", { name: "Tenner anlegen" });

async function fillValid() {
  await userEvent.type(screen.getByRole("textbox", { name: "Titel" }), "Fenster putzen");
}

describe("CreateTennerDialog", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));

  it("opens with defaults and a disabled submit button", () => {
    renderDialog();
    expect(screen.getByRole("textbox", { name: "Titel" })).toHaveValue("");
    expect(screen.getByRole("spinbutton", { name: "Geschätzte Minuten" })).toHaveValue(10);
    expect(screen.getByRole("spinbutton", { name: "Häufigkeit in Tagen" })).toHaveValue(14);
    expect(screen.getByRole("combobox", { name: "Kategorie" })).toHaveTextContent("Haushalt");
    expect(screen.getByRole("combobox", { name: "Zuständig" })).toHaveTextContent("Stefan");
    expect(submitButton()).toBeDisabled();
  });

  it("validates inline before submitting", async () => {
    renderDialog();
    await userEvent.type(screen.getByRole("textbox", { name: "Titel" }), "ab");
    expect(await screen.findByText("Der Titel braucht mindestens 3 Zeichen.")).toBeInTheDocument();

    const minutes = screen.getByRole("spinbutton", { name: "Geschätzte Minuten" });
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "500");
    expect(await screen.findByText("Geschätzte Minuten müssen zwischen 1 und 480 liegen.")).toBeInTheDocument();

    const frequency = screen.getByRole("spinbutton", { name: "Häufigkeit in Tagen" });
    await userEvent.clear(frequency);
    expect(await screen.findByText("Bitte eine Zahl eingeben.")).toBeInTheDocument();
    await userEvent.type(frequency, "0");
    expect(await screen.findByText("Die Häufigkeit muss zwischen 1 und 3650 Tagen liegen.")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("rejects a blank title and fractional minutes", async () => {
    renderDialog();
    const title = screen.getByRole("textbox", { name: "Titel" });
    await userEvent.type(title, "x");
    await userEvent.clear(title);
    expect(await screen.findByText("Titel ist erforderlich.")).toBeInTheDocument();
    const minutes = screen.getByRole("spinbutton", { name: "Geschätzte Minuten" });
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "2.5");
    expect(await screen.findByText("Bitte eine ganze Zahl eingeben.")).toBeInTheDocument();
  });

  it("sets the frequency through presets", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Monatlich (30)" }));
    expect(screen.getByRole("spinbutton", { name: "Häufigkeit in Tagen" })).toHaveValue(30);
    expect(screen.getByRole("button", { name: "Monatlich (30)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("creates the Tenner, closes, notifies and refreshes dashboard and lists", async () => {
    const fetchMock = mockFetch({ "POST /tenners": ok(tenner({ title: "Fenster putzen" }), 201) });
    const { queryClient, onClose } = renderDialog();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await fillValid();
    await userEvent.click(screen.getByRole("combobox", { name: "Kategorie" }));
    await userEvent.click(await screen.findByRole("option", { name: "Haus & Garten" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Zuständig" }));
    await userEvent.click(await screen.findByRole("option", { name: "Julia" }));
    await userEvent.click(screen.getByRole("button", { name: "Wöchentlich (7)" }));
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await userEvent.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(fetchMock.calls()[0]?.body).toEqual({
      title: "Fenster putzen",
      category: "HOME",
      assignedTo: "JULIA",
      estimatedMinutes: 10,
      frequencyDays: 7,
    });
    expect(await screen.findByText("✅ „Fenster putzen“ angelegt.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.tenners });
  });

  it("keeps the input and shows an error when saving fails", async () => {
    mockFetch({
      "POST /tenners": { status: 500, body: { success: false, error: { code: "INTERNAL_ERROR", message: "x" } } },
    });
    const { onClose } = renderDialog();
    await fillValid();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await userEvent.click(submitButton());
    expect(
      await screen.findByText(
        "Tenner konnte nicht angelegt werden. Tenner ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Titel" })).toHaveValue("Fenster putzen");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("never retries a failed create automatically (no idempotency key, UX-005)", async () => {
    const fetchMock = mockFetch({
      "POST /tenners": { status: 503, body: { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "x" } } },
    });
    renderDialog();
    await fillValid();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await userEvent.click(submitButton());
    await screen.findByText(/^Tenner konnte nicht angelegt werden/);
    expect(fetchMock.calls().filter((call) => call.key === "POST /tenners")).toHaveLength(1);
  });

  it("shows backend validation messages on the field", async () => {
    const invalid: MockResponse = {
      status: 400,
      body: {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid",
          details: [{ field: "title", message: "Titel ist bereits vergeben." }],
        },
      },
    };
    mockFetch({ "POST /tenners": invalid });
    renderDialog();
    await fillValid();
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await userEvent.click(submitButton());
    expect(await screen.findByText("Titel ist bereits vergeben.")).toBeInTheDocument();
  });

  it("resets and closes on cancel", async () => {
    const { onClose, dialog } = renderDialog();
    await fillValid();
    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
