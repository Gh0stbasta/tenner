/**
 * Current user (FRONTEND-007): who completes Tenners on this device. Stored in localStorage;
 * default Stefan. FRONTEND-008 moves the selection into the settings page.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { USER_IDS, type UserId } from "../../types/domain";

export const DEFAULT_USER: UserId = "STEFAN";
export const CURRENT_USER_STORAGE_KEY = "tenner.currentUser";

function isUserId(value: unknown): value is UserId {
  return typeof value === "string" && (USER_IDS as readonly string[]).includes(value);
}

function readStoredUser(): UserId {
  try {
    const stored = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return isUserId(stored) ? stored : DEFAULT_USER;
  } catch {
    return DEFAULT_USER; // storage blocked (e.g. private mode)
  }
}

interface CurrentUserContextValue {
  readonly user: UserId;
  readonly setUser: (user: UserId) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export function CurrentUserProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUserState] = useState<UserId>(readStoredUser);
  const setUser = useCallback((next: UserId) => {
    setUserState(next);
    try {
      window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, next);
    } catch {
      // Keep the in-memory value if storage is unavailable.
    }
  }, []);
  const value = useMemo(() => ({ user, setUser }), [user, setUser]);
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
export function useSetCurrentUser(): (user: UserId) => void {
  return useCurrentUserContext().setUser;
}
