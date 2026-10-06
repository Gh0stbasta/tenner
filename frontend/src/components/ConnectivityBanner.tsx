/**
 * Connectivity feedback (UX-005): offline (navigator.onLine) or API unreachable
 * (a read failed with a network error, 429 or 5xx and has not succeeded since).
 */

import { Alert, Collapse } from "@mui/material";
import { useDataAge } from "../features/offline/useDataAge";
import { useApiUnreachable, useOnline } from "../hooks/useConnectivity";
import { formatRelativeTime } from "../utils/format";

export function ConnectivityBanner() {
  const online = useOnline();
  const unreachable = useApiUnreachable();
  const dataAge = useDataAge();
  const message = !online
    ? "Keine Internetverbindung. Tenner aktualisiert sich, sobald du wieder online bist."
    : unreachable
      ? "Tenner ist nicht erreichbar. Neuer Versuch läuft…"
      : null;
  return (
    <Collapse in={message !== null} unmountOnExit>
      <Alert severity="warning" role="status" sx={{ mb: 2 }}>
        <div>{message}</div>
        {/* MOBILE-003: the data shown comes from the offline cache or the last successful read. */}
        {dataAge !== undefined && (
          <div>Angezeigt wird der Stand von {formatRelativeTime(new Date(dataAge).toISOString())}.</div>
        )}
      </Alert>
    </Collapse>
  );
}
