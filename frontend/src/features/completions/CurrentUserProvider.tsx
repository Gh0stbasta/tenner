/**
 * Current user (FRONTEND-007, SECURITY-003): the logged-in household member from the ID token
 * (household group in cognito:groups). Provided by the AuthGate; tests provide a fixed user.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { UserId } from "../../types/domain";

interface CurrentUserContextValue {
  readonly user: UserId;
  readonly logout: () => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export interface CurrentUserProviderProps {
  readonly user: UserId;
  readonly logout: () => void;
  readonly children: ReactNode;
}

export function CurrentUserProvider({ user, logout, children }: CurrentUserProviderProps) {
  const value = useMemo(() => ({ user, logout }), [user, logout]);
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

function useCurrentUserContext(): CurrentUserContextValue {
  const context = useContext(CurrentUserContext);
  if (!context) throw new Error("useCurrentUser must be used inside CurrentUserProvider.");
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components -- hooks belong to their provider
export function useCurrentUser(): UserId {
  return useCurrentUserContext().user;
}

// eslint-disable-next-line react-refresh/only-export-components -- hooks belong to their provider
export function useLogout(): () => void {
  return useCurrentUserContext().logout;
}
