/**
 * Connectivity feedback (UX-005): offline (navigator.onLine) or API unreachable
 * (a read failed with a network error, 429 or 5xx and has not succeeded since).
 */

import { Alert, Collapse } from "@mui/material";
import { useApiUnreachable, useOnline } from "../hooks/useConnectivity";

export function ConnectivityBanner() {
  const online = useOnline();
  const unreachable = useApiUnreachable();
  const message = !online
    ? "Keine Internetverbindung. Tenner aktualisiert sich, sobald du wieder online bist."
    : unreachable
      ? "Tenner ist nicht erreichbar. Neuer Versuch läuft…"
      : null;
  return (
    <Collapse in={message !== null} unmountOnExit>
      <Alert severity="warning" role="status" sx={{ mb: 2 }}>
        {message}
      </Alert>
    </Collapse>
  );
}
