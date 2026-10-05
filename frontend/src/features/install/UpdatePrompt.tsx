/**
 * Offers a new app version (MOBILE-002). The service worker precaches the app shell; after a deploy the new worker
 * waits until the user reloads here, or activates on the next launch once all windows are closed, so a stale shell is
 * served for at most one launch. Long-running sessions check for updates hourly.
 */

import { Button, Snackbar } from "@mui/material";
import { useRegisterSW } from "virtual:pwa-register/react";

export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS);
    },
  });
  return (
    <Snackbar
      open={needRefresh}
      message="Neue Version verfügbar."
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      action={
        <>
          <Button color="inherit" size="small" onClick={() => setNeedRefresh(false)}>
            Später
          </Button>
          <Button color="primary" variant="contained" size="small" onClick={() => void updateServiceWorker(true)}>
            Neu laden
          </Button>
        </>
      }
    />
  );
}
