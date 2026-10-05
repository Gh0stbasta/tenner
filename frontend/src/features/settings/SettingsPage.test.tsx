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

describe("SettingsPage", () => {
  beforeEach(() => {
    mockFetch({ "GET /household": ok({ timezone: "Europe/Berlin" }) });
  });

  it("shows all sections and the signed-in person read-only", async () => {
    renderWithProviders(<SettingsPage />, { user: "JULIA" });
    for (const name of ["Profil", "Standardwerte für neue Tenner", "Dashboard", "App"]) {
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

  it("quick add defaults change and persist", async () => {
    renderWithProviders(<SettingsPage />);
    await choose("Kategorie", "Fitness");
    await choose("Zuständig", "Julia");
    const minutes = screen.getByLabelText("Geschätzte Dauer (Minuten)");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "25");
    const frequency = screen.getByLabelText("Häufigkeit (alle … Tage)");
    await userEvent.clear(frequency);
    await userEvent.type(frequency, "7");
    expect(loadPreferences()).toMatchObject({
      defaultCategory: "FITNESS",
      defaultAssignedTo: "JULIA",
      defaultEstimatedMinutes: 25,
      defaultFrequencyDays: 7,
    });
  });

  it("rejects numbers outside the range and restores the saved value on blur", async () => {
    renderWithProviders(<SettingsPage />);
    const minutes = screen.getByLabelText("Geschätzte Dauer (Minuten)");
    await userEvent.clear(minutes);
    expect(screen.getByText("Bitte eine ganze Zahl von 1 bis 480 eingeben.")).toBeInTheDocument();
    await userEvent.tab();
    expect(minutes).toHaveValue(10);
    // Valid prefixes are saved while typing ("4", "48"); the invalid "481" is not.
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "481");
    expect(screen.getByText("Bitte eine ganze Zahl von 1 bis 480 eingeben.")).toBeInTheDocument();
    await userEvent.tab();
    expect(minutes).toHaveValue(48);
    expect(loadPreferences().defaultEstimatedMinutes).toBe(48);
  });

  it("dashboard preference change", async () => {
    renderWithProviders(<SettingsPage />);
    const upcoming = screen.getByRole("switch", { name: "Demnächst fällige Tenner" });
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
      "PUT /household": ({ init }) => ok(JSON.parse(String(init?.body)) as unknown),
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
      preferences: { ...DEFAULT_PREFERENCES, showUpcoming: false, defaultCategory: "FINANCE" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Auf Standardwerte zurücksetzen" }));
    await userEvent.click(await screen.findByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByRole("switch", { name: "Demnächst fällige Tenner" })).not.toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Auf Standardwerte zurücksetzen" }));
    expect(
      await screen.findByText("Alle Einstellungen auf diesem Gerät werden auf die Standardwerte zurückgesetzt."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));
    await waitFor(async () =>
      expect(await screen.findByRole("switch", { name: "Demnächst fällige Tenner" })).toBeChecked(),
    );
    expect(await screen.findByRole("combobox", { name: "Kategorie" })).toHaveTextContent("Haushalt");
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("responsive layout: controls use the full width on small screens", () => {
    renderWithProviders(<SettingsPage />);
    for (const label of ["Geschätzte Dauer (Minuten)", "Häufigkeit (alle … Tage)", "Zeitzone des Haushalts"]) {
      expect(screen.getByLabelText(label).closest(".MuiFormControl-root")).toHaveClass("MuiFormControl-fullWidth");
    }
  });
});

describe("SettingsProvider", () => {
  function Probe() {
    const { preferences, update } = useSettings();
    return (
      <button type="button" onClick={() => update({ defaultFrequencyDays: preferences.defaultFrequencyDays + 1 })}>
        {preferences.defaultFrequencyDays}
      </button>
    );
  }

  it("loads from localStorage, provides and persists updates", async () => {
    localStorage.setItem(
      "tenner.preferences",
      JSON.stringify({ version: 1, preferences: { defaultFrequencyDays: 30 } }),
    );
    renderWithProviders(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "30" }));
    expect(screen.getByRole("button", { name: "31" })).toBeInTheDocument();
    expect(loadPreferences().defaultFrequencyDays).toBe(31);
  });
});
