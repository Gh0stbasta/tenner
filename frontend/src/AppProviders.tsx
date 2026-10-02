/** Application-wide providers: theme, query client, notifications and error boundary (FRONTEND-001). */

import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationProvider } from "./components/NotificationProvider";
import { theme } from "./theme/theme";

export interface AppProvidersProps {
  readonly queryClient: QueryClient;
  readonly children: ReactNode;
}

/** Session-dependent providers (current user, completions) are mounted by the AuthGate. */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>{children}</NotificationProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
