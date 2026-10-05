import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../api/queryKeys";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { tenner } from "../../tests/fixtures";
import { renderWithProviders } from "../../tests/render";
import { EditTennerDialog } from "./EditTennerDialog";
import type { Tenner } from "./schemas";

const EXISTING = tenner({
  tennerId: "t-9",
  title: "Büro saugen",
  lastCompleted: "2026-09-20T10:00:00Z",
  nextDue: "2026-10-04",
});

function renderDialog(current: Tenner | null = EXISTING, onClose = vi.fn()) {
  const result = renderWithProviders(<EditTennerDialog tenner={current} onClose={onClose} />);
  return { ...result, onClose };
}

const saveButton = () => screen.getByRole("button", { name: "Änderungen speichern" });
const titleInput = () => screen.getByRole("textbox", { name: "Titel" });

describe("EditTennerDialog", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));

  it("renders nothing without a Tenner", () => {
    renderDialog(null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads the existing values and read-only facts; save is disabled without changes", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "Tenner bearbeiten" })).toBeInTheDocument();
    expect(titleInput()).toHaveValue("Büro saugen");
    expect(screen.getByRole("spinbutton", { name: "Wiederholen alle" })).toHaveValue(14);
    expect(screen.getByRole("combobox", { name: "Einheit" })).toHaveTextContent("Tage");
    expect(screen.getByRole("switch", { name: "Aktiv" })).toBeChecked();
    expect(screen.getByText("t-9")).toBeInTheDocument();
    expect(screen.getByText("So., 4. Okt.")).toBeInTheDocument();
    expect(screen.getByText(/^20\.09\.2026/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("shows 'Noch nie' for Tenners that were never completed", () => {
    renderDialog(tenner({ lastCompleted: null }));
    expect(screen.getByText("Noch nie")).toBeInTheDocument();
  });

  it("validates changes inline", async () => {
    renderDialog();
    await userEvent.clear(titleInput());
    await userEvent.type(titleInput(), "ab");
    expect(await screen.findByText("Der Titel braucht mindestens 3 Zeichen.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("sends only changed fields, closes, notifies and refreshes", async () => {
    const fetchMock = mockFetch({
      "PUT /tenners/t-9": ok({
        ...EXISTING,
        title: "Büro gründlich saugen",
        frequencyUnit: "MONTH",
        frequencyInterval: 1,
      }),
    });
    const { onClose, queryClient } = renderDialog();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await userEvent.clear(titleInput());
    await userEvent.type(titleInput(), "Büro gründlich saugen");
    await userEvent.click(screen.getByRole("button", { name: "Monatlich" }));
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await userEvent.click(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(fetchMock.calls().find((call) => call.key !== "GET /users")?.body).toEqual({
      title: "Büro gründlich saugen",
      frequencyUnit: "MONTH",
      frequencyInterval: 1,
      weekdays: null,
    });
    expect(await screen.findByText("✅ Tenner aktualisiert.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.tenners });
  });

  it("sends the frequency as a unit/interval pair when only the interval changes (SCHEDULING-001)", async () => {
    const fetchMock = mockFetch({ "PUT /tenners/t-9": ok({ ...EXISTING, frequencyDays: 21, frequencyInterval: 21 }) });
    const { onClose } = renderDialog();
    const frequency = screen.getByRole("spinbutton", { name: "Wiederholen alle" });
    await userEvent.clear(frequency);
    await userEvent.type(frequency, "21");
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(fetchMock.calls().find((call) => call.key !== "GET /users")?.body).toEqual({
      frequencyUnit: "DAY",
      frequencyInterval: 21,
      weekdays: null,
    });
  });

  it("loads and changes weekdays of a weekday-bound Tenner (SCHEDULING-002)", async () => {
    const fetchMock = mockFetch({ "PUT /tenners/t-9": ok({ ...EXISTING, weekdays: ["SAT", "SUN"] }) });
    const { onClose } = renderDialog({
      ...EXISTING,
      frequencyUnit: "WEEK",
      frequencyInterval: 1,
      frequencyDays: 7,
      weekdays: ["SAT"],
    });
    const weekdays = screen.getByRole("group", { name: "An Wochentagen (optional)" });
    expect(within(weekdays).getByRole("button", { name: "Sa" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(weekdays).getByRole("button", { name: "So" }));
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await userEvent.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(fetchMock.calls().find((call) => call.key !== "GET /users")?.body).toEqual({
      frequencyUnit: "WEEK",
      frequencyInterval: 1,
      weekdays: ["SAT", "SUN"],
    });
  });

  it("deactivates through the Active toggle", async () => {
    const fetchMock = mockFetch({ "PUT /tenners/t-9": ok({ ...EXISTING, active: false }) });
    renderDialog();
    await userEvent.click(screen.getByRole("switch", { name: "Aktiv" }));
    expect(screen.getByRole("switch", { name: "Inaktiv" })).not.toBeChecked();
    await userEvent.click(saveButton());
    await waitFor(() =>
      expect(fetchMock.calls().find((call) => call.key !== "GET /users")?.body).toEqual({ active: false }),
    );
  });

  it("reactivates an inactive Tenner", async () => {
    const fetchMock = mockFetch({ "PUT /tenners/t-9": ok(EXISTING) });
    renderDialog({ ...EXISTING, active: false });
    await userEvent.click(screen.getByRole("switch", { name: "Inaktiv" }));
    await userEvent.click(saveButton());
    await waitFor(() =>
      expect(fetchMock.calls().find((call) => call.key !== "GET /users")?.body).toEqual({ active: true }),
    );
  });

  it("keeps the changes and shows an error when saving fails", async () => {
    mockFetch({ "PUT /tenners/t-9": fail(500, "INTERNAL_ERROR") });
    const { onClose } = renderDialog();
    await userEvent.type(titleInput(), " neu");
    await userEvent.click(saveButton());
    expect(
      await screen.findByText(
        "Änderungen konnten nicht gespeichert werden. Tenner ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
      ),
    ).toBeInTheDocument();
    expect(titleInput()).toHaveValue("Büro saugen neu");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks before discarding unsaved changes", async () => {
    const { onClose } = renderDialog();
    await userEvent.type(titleInput(), " neu");
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    const confirm = screen.getByRole("dialog", { name: "Ungespeicherte Änderungen verwerfen?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Weiter bearbeiten" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole("textbox", { name: "Titel" })).toHaveValue("Büro saugen neu");

    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Ungespeicherte Änderungen verwerfen?" })).getByRole("button", {
        name: "Verwerfen",
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes without asking when nothing changed", async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByText("Ungespeicherte Änderungen verwerfen?")).not.toBeInTheDocument();
  });
});
