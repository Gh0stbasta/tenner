/** Application-wide providers: settings, theme, query client, notifications and error boundary (FRONTEND-001, 008). */

import { CssBaseline, ThemeProvider, useMediaQuery } from "@mui/material";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationProvider } from "./components/NotificationProvider";
import { SettingsProvider, useSettings } from "./features/settings/SettingsProvider";
import type { UserPreferences } from "./features/settings/preferences";
import { createAppTheme } from "./theme/theme";

export interface AppProvidersProps {
  readonly queryClient: QueryClient;
  readonly children: ReactNode;
  /** Preferences to start with (tests); default: from localStorage. */
  readonly preferences?: UserPreferences;
}

/** Applies the theme preference (Light, Dark or the system setting) without a reload. */
function ThemedApp({ children }: { readonly children: ReactNode }) {
  const { preferences } = useSettings();
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const mode =
    preferences.theme === "SYSTEM"
      ? systemPrefersDark
        ? "dark"
        : "light"
      : preferences.theme === "DARK"
        ? "dark"
        : "light";
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}

/** Session-dependent providers (current user, completions) are mounted by the AuthGate. */
export function AppProviders({ queryClient, children, preferences }: AppProvidersProps) {
  return (
    <SettingsProvider initial={preferences}>
      <ThemedApp>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <NotificationProvider>{children}</NotificationProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemedApp>
    </SettingsProvider>
  );
}
