/** Application-wide providers: theme, query client and error boundary (FRONTEND-001). */

import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationProvider } from "./components/NotificationProvider";
import { CompletionProvider } from "./features/completions/CompletionProvider";
import { CurrentUserProvider } from "./features/completions/CurrentUserProvider";
import { theme } from "./theme/theme";

export interface AppProvidersProps {
  readonly queryClient: QueryClient;
  readonly children: ReactNode;
}

export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <NotificationProvider>
            <CurrentUserProvider>
              <CompletionProvider>{children}</CompletionProvider>
            </CurrentUserProvider>
          </NotificationProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
