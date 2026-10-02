/** Global snackbar notifications with an optional action (e.g. "Rückgängig", FRONTEND-007). */

import { Alert, Button, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface NotificationAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface Notification {
  readonly message: string;
  readonly severity?: "success" | "info" | "error";
  readonly action?: NotificationAction;
  /** Milliseconds until the snackbar hides. Default: 4000. */
  readonly durationMs?: number;
}

type Notify = (notification: Notification) => void;

const NotificationContext = createContext<Notify | null>(null);

interface Entry extends Notification {
  readonly key: number;
}

export function NotificationProvider({ children }: { readonly children: ReactNode }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [open, setOpen] = useState(false);

  const notify = useCallback<Notify>((notification) => {
    setEntry({ ...notification, key: Date.now() });
    setOpen(true);
  }, []);

  const close = useCallback((_?: unknown, reason?: string) => {
    if (reason !== "clickaway") setOpen(false);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        key={entry?.key}
        open={open}
        autoHideDuration={entry?.durationMs ?? 4000}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={entry?.severity ?? "success"}
          variant="filled"
          onClose={close}
          action={
            entry?.action && (
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  setOpen(false);
                  entry.action?.onClick();
                }}
              >
                {entry.action.label}
              </Button>
            )
          }
          sx={{ width: "100%", alignItems: "center" }}
        >
          {entry?.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs to its provider
export function useNotify(): Notify {
  const notify = useContext(NotificationContext);
  if (!notify) throw new Error("useNotify must be used inside NotificationProvider.");
  return notify;
}
