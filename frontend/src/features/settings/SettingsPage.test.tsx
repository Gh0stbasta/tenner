import { useTheme } from "@mui/material";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DEFAULT_PREFERENCES, loadPreferences } from "./preferences";
import { SettingsPage } from "./SettingsPage";
import { SettingsProvider, useSettings } from "./SettingsProvider";

function PaletteMode() {
  return <p>Modus: {useTheme().palette.mode}</p>;
}

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

/** PUT /household echoes the saved changes over the stored household. */
const echoHousehold =
  (stored: Record<string, unknown> = {}) =>
  ({ init }: { init: RequestInit | undefined }) =>
    ok({
      timezone: "Europe/Berlin",
      ...stored,
      ...(JSON.parse(String(init?.body)) as Record<string, unknown>),
      defaultsSource: "HOUSEHOLD",
    });

describe("SettingsPage", () => {
  beforeEach(() => {
    mockFetch({ "GET /household": ok({ timezone: "Europe/Berlin" }), "PUT /household": echoHousehold() });
  });

  it("shows all sections and the signed-in person read-only", async () => {
    renderWithProviders(<SettingsPage />, { user: "JULIA" });
    for (const name of [
      "Profil",
      "Persönlich",
      "Dashboard",
      "Haushalt",
      "Standardwerte für neue Aufgaben",
      "Haushaltsmitglieder",
      "Kategorien",
      "Alexa",
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(within(screen.getByRole("region", { name: "Profil" })).getByText("Julia")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Person|Benutzer/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Zeitzone des Haushalts")).toHaveValue("Europe/Berlin"));
  });

  it("logs out from the profile section", async () => {
    const logout = vi.fn();
    renderWithProviders(<SettingsPage />, { logout });
    await userEvent.click(
      within(screen.getByRole("region", { name: "Profil" })).getByRole("button", { name: "Abmelden" }),
    );
    expect(logout).toHaveBeenCalledOnce();
  });

  it("keeps the default assignee on this device (personal)", async () => {
    renderWithProviders(<SettingsPage />);
    await choose("Zuständig für neue Aufgaben", "Julia");
    expect(loadPreferences().defaultAssignedTo).toBe("JULIA");
  });

  it("saves the household defaults for new Tenners on the server (HOUSEHOLD-ADMIN-003)", async () => {
    const fetchMock = mockFetch({
      "GET /household": ok({ timezone: "Europe/Berlin" }),
      "PUT /household": echoHousehold(),
    });
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Kategorie" })).toHaveTextContent("Haushalt"));
    await choose("Kategorie", "Fitness");
    await waitFor(() =>
      expect(
        fetchMock
          .calls()
          .filter((call) => call.key === "PUT /household")
          .at(-1)?.body,
      ).toEqual({
        defaults: { category: "FITNESS", estimatedMinutes: 10, frequencyDays: 14 },
      }),
    );
    const minutes = screen.getByLabelText("Geschätzte Dauer (Minuten)");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "25");
    expect(fetchMock.calls().filter((call) => call.key === "PUT /household")).toHaveLength(1); // saved on leaving
    await userEvent.tab();
    await waitFor(() =>
      expect(
        fetchMock
          .calls()
          .filter((call) => call.key === "PUT /household")
          .at(-1)?.body,
      ).toEqual({
        defaults: { category: "FITNESS", estimatedMinutes: 25, frequencyDays: 14 },
      }),
    );
  });

  it("rejects numbers outside the range and restores the saved value on blur", async () => {
    const fetchMock = mockFetch({
      "GET /household": ok({ timezone: "Europe/Berlin" }),
      "PUT /household": echoHousehold(),
    });
    renderWithProviders(<SettingsPage />);
    const minutes = await screen.findByLabelText("Geschätzte Dauer (Minuten)");
    await userEvent.clear(minutes);
    expect(screen.getByText("Bitte eine ganze Zahl von 1 bis 480 eingeben.")).toBeInTheDocument();
    await userEvent.type(minutes, "481");
    await userEvent.tab();
    expect(minutes).toHaveValue(10);
    expect(fetchMock.calls().some((call) => call.key === "PUT /household")).toBe(false);
  });

  it("edits name, week start and workdays of the household", async () => {
    const fetchMock = mockFetch({
      "GET /household": ok({ timezone: "Europe/Berlin", name: "Unser Haushalt" }),
      "PUT /household": echoHousehold({ name: "Unser Haushalt" }),
    });
    renderWithProviders(<SettingsPage />);
    const name = await screen.findByLabelText("Name des Haushalts");
    await userEvent.clear(name);
    await userEvent.type(name, "Familie S.{Enter}");
    await userEvent.tab();
    expect(await screen.findByText("Name gespeichert.")).toBeInTheDocument();
    await choose("Woche beginnt am", "Sonntag");
    const workdays = within(screen.getByRole("group", { name: "Arbeitstage" }));
    await userEvent.click(workdays.getByRole("button", { name: "Sa" }));
    const puts = () =>
      fetchMock
        .calls()
        .filter((call) => call.key === "PUT /household")
        .map((call) => call.body);
    await waitFor(() =>
      expect(puts()).toEqual([
        { name: "Familie S." },
        { weekStartsOn: "SUNDAY" },
        { workdays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] },
      ]),
    );
  });

  it("offers to move Quick Add defaults stored on this device to the household", async () => {
    localStorage.setItem(
      "tenner.preferences",
      JSON.stringify({
        version: 1,
        preferences: { defaultCategory: "FITNESS", defaultEstimatedMinutes: 25, defaultFrequencyDays: 7 },
      }),
    );
    const fetchMock = mockFetch({
      "GET /household": ok({ timezone: "Europe/Berlin" }),
      "PUT /household": echoHousehold(),
    });
    renderWithProviders(<SettingsPage />);
    expect(
      await screen.findByText(
        /Auf diesem Gerät sind eigene Standardwerte gespeichert \(Fitness, 25 Min\., alle 7 Tage\)/,
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
    expect(await screen.findByText("Standardwerte übernommen.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "PUT /household")?.body).toEqual({
      defaults: { category: "FITNESS", estimatedMinutes: 25, frequencyDays: 7 },
    });
    expect(screen.queryByText(/Auf diesem Gerät sind eigene Standardwerte/)).not.toBeInTheDocument();
    expect(localStorage.getItem("tenner.preferences")).not.toContain("defaultCategory");
  });

  it("does not offer the migration once the household has its own defaults, and can be dismissed", async () => {
    localStorage.setItem(
      "tenner.preferences",
      JSON.stringify({ version: 1, preferences: { defaultEstimatedMinutes: 25 } }),
    );
    mockFetch({ "GET /household": ok({ timezone: "Europe/Berlin", defaultsSource: "HOUSEHOLD" }) });
    const first = renderWithProviders(<SettingsPage />);
    expect(await screen.findByLabelText("Geschätzte Dauer (Minuten)")).toBeInTheDocument();
    expect(screen.queryByText(/Auf diesem Gerät sind eigene Standardwerte/)).not.toBeInTheDocument();
    first.unmount();
    const fetchMock = mockFetch({ "GET /household": ok({ timezone: "Europe/Berlin" }) });
    renderWithProviders(<SettingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Verwerfen" }));
    expect(screen.queryByText(/Auf diesem Gerät sind eigene Standardwerte/)).not.toBeInTheDocument();
    expect(fetchMock.calls().some((call) => call.key === "PUT /household")).toBe(false);
  });

  it("dashboard preference change", async () => {
    renderWithProviders(<SettingsPage />);
    const upcoming = screen.getByRole("switch", { name: "Demnächst fällige Aufgaben" });
    expect(upcoming).toBeChecked();
    await userEvent.click(upcoming);
    expect(upcoming).not.toBeChecked();
    expect(loadPreferences().showUpcoming).toBe(false);
  });

  it("theme change applies immediately without reload", async () => {
    renderWithProviders(
      <>
        <SettingsPage />
        <PaletteMode />
      </>,
    );
    expect(screen.getByText("Modus: light")).toBeInTheDocument();
    await choose("Darstellung", "Dunkel");
    expect(await screen.findByText("Modus: dark")).toBeInTheDocument();
    expect(loadPreferences().theme).toBe("DARK");
    await choose("Darstellung", "Hell");
    expect(await screen.findByText("Modus: light")).toBeInTheDocument();
  });

  it("timezone is configurable for the household (SCHEDULING-008)", async () => {
    const fetchMock = mockFetch({
      "GET /household": ok({ timezone: "Europe/Berlin" }),
      "PUT /household": echoHousehold(),
      "GET /dashboard": ok({}),
    });
    const { queryClient } = renderWithProviders(<SettingsPage />);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const input = screen.getByLabelText("Zeitzone des Haushalts");
    await waitFor(() => expect(input).toHaveValue("Europe/Berlin"));
    await userEvent.clear(input);
    await userEvent.type(input, "Europe/Vien");
    await userEvent.click(await screen.findByRole("option", { name: "Europe/Vienna" }));
    expect(await screen.findByText("Zeitzone auf Europe/Vienna geändert.")).toBeInTheDocument();
    expect(fetchMock.calls().find((call) => call.key === "PUT /household")?.body).toEqual({
      timezone: "Europe/Vienna",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tenners"] });
  });

  it("shows an error when the timezone cannot be saved or loaded", async () => {
    mockFetch({ "GET /household": ok({ timezone: "Europe/Berlin" }), "PUT /household": fail(400, "VALIDATION_ERROR") });
    renderWithProviders(<SettingsPage />);
    const input = screen.getByLabelText("Zeitzone des Haushalts");
    await waitFor(() => expect(input).toHaveValue("Europe/Berlin"));
    await userEvent.clear(input);
    await userEvent.type(input, "Asia/Toky");
    await userEvent.click(await screen.findByRole("option", { name: "Asia/Tokyo" }));
    expect(await screen.findByText(/Die Zeitzone konnte nicht gespeichert werden/)).toBeInTheDocument();
  });

  it("system theme follows the device setting", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("dark"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
      })),
    );
    renderWithProviders(<PaletteMode />);
    expect(screen.getByText("Modus: dark")).toBeInTheDocument();
  });

  it("reset preferences after confirmation; cancel keeps them", async () => {
    renderWithProviders(<SettingsPage />, {
      preferences: { ...DEFAULT_PREFERENCES, showUpcoming: false, defaultAssignedTo: "JULIA" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Auf Standardwerte zurücksetzen" }));
    await userEvent.click(await screen.findByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByRole("switch", { name: "Demnächst fällige Aufgaben" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Auf Standardwerte zurücksetzen" }));
    expect(
      await screen.findByText("Alle Einstellungen auf diesem Gerät werden auf die Standardwerte zurückgesetzt."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));
    await waitFor(async () =>
      expect(await screen.findByRole("switch", { name: "Demnächst fällige Aufgaben" })).toBeChecked(),
    );
    expect(screen.getByRole("combobox", { name: "Zuständig für neue Aufgaben" })).toHaveTextContent("Ich selbst");
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    // Two dialogs on the full settings page (incl. the meal sections) take ~3.5 s alone, more in the full run.
  }, 15_000);

  it("responsive layout: controls use the full width on small screens", async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findByLabelText("Geschätzte Dauer (Minuten)");
    for (const label of [
      "Geschätzte Dauer (Minuten)",
      "Häufigkeit (alle … Tage)",
      "Zeitzone des Haushalts",
      "Name des Haushalts",
    ]) {
      expect(screen.getByLabelText(label).closest(".MuiFormControl-root")).toHaveClass("MuiFormControl-fullWidth");
    }
  });
});

describe("SettingsProvider", () => {
  function Probe() {
    const { preferences, update } = useSettings();
    return (
      <button type="button" onClick={() => update({ showUpcoming: !preferences.showUpcoming })}>
        {String(preferences.showUpcoming)}
      </button>
    );
  }

  it("loads from localStorage, provides and persists updates", async () => {
    localStorage.setItem("tenner.preferences", JSON.stringify({ version: 1, preferences: { showUpcoming: false } }));
    renderWithProviders(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "false" }));
    expect(screen.getByRole("button", { name: "true" })).toBeInTheDocument();
    expect(loadPreferences().showUpcoming).toBe(true);
  });
});
