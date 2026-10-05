/**
 * Settings context (FRONTEND-008): loads the preferences once, persists every change and provides them to the
 * app. Mounted above the theme, so the theme preference applies without a reload.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type ThemeMode,
  type UserPreferences,
} from "./preferences";

interface SettingsContextValue {
  readonly preferences: UserPreferences;
  readonly update: (changes: Partial<UserPreferences>) => void;
  readonly reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export interface SettingsProviderProps {
  readonly children: ReactNode;
  /** Start values (tests); default: from localStorage. */
  readonly initial?: UserPreferences;
}

export function SettingsProvider({ children, initial }: SettingsProviderProps) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => initial ?? loadPreferences());

  const update = useCallback((changes: Partial<UserPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...changes };
      savePreferences(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  const value = useMemo(() => ({ preferences, update, reset }), [preferences, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hooks belong to their provider
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider.");
  return context;
}

/** Theme preference hook (named to avoid confusion with MUI's useTheme). */
// eslint-disable-next-line react-refresh/only-export-components -- hooks belong to their provider
export function useThemePreference(): readonly [ThemeMode, (mode: ThemeMode) => void] {
  const { preferences, update } = useSettings();
  return [preferences.theme, (theme: ThemeMode) => update({ theme })] as const;
}
