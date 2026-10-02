/** Test helpers: render with all providers, a logged-in household member and a memory router. */

import { QueryClient } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { AppProviders } from "../AppProviders";
import { CompletionProvider } from "../features/completions/CompletionProvider";
import { CurrentUserProvider } from "../features/completions/CurrentUserProvider";
import type { UserId } from "../types/domain";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

export interface RenderOptions {
  readonly route?: string;
  readonly queryClient?: QueryClient;
  /** Logged-in household member (default Stefan). */
  readonly user?: UserId;
  readonly logout?: () => void;
  /** Skip the session providers (for components that render before login, e.g. the AuthGate). */
  readonly withoutSession?: boolean;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    queryClient = createTestQueryClient(),
    user = "STEFAN",
    logout = () => undefined,
    withoutSession = false,
  }: RenderOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const content = withoutSession ? (
    ui
  ) : (
    <CurrentUserProvider user={user} logout={logout}>
      <CompletionProvider>{ui}</CompletionProvider>
    </CurrentUserProvider>
  );
  const result = render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>
    </AppProviders>,
  );
  return { ...result, queryClient };
}
