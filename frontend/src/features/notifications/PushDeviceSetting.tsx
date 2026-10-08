/** "Push aufs Handy" for this device (NOTIFICATION-009): enable or disable, with hints for iPhone and blocked permission. */

import { Alert, Box, Button, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { config } from "../../config";
import { disablePush, enablePush, needsInstallForPush, pushState, type PushState } from "./push";

export interface PushDeviceSettingProps {
  readonly userId: string;
  /** Preferences query key prefix, refreshed so that "Push aufs Handy" becomes selectable. */
  readonly preferencesKey: readonly unknown[];
  /** VAPID public key; default from the build configuration. */
  readonly publicKey?: string;
}

export function PushDeviceSetting({
  userId,
  preferencesKey,
  publicKey = config.webPushPublicKey,
}: PushDeviceSettingProps) {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    pushState(publicKey)
      .then((current) => active && setState(current))
      .catch(() => active && setState("unsupported"));
    return () => {
      active = false;
    };
  }, [publicKey]);

  if (state === "loading" || state === "not-configured") return null;

  const change = (action: () => Promise<PushState>, success: string) => {
    setBusy(true);
    action()
      .then((next) => {
        setState(next);
        if (next === "on" || next === "off") notify({ message: success });
        return queryClient.invalidateQueries({ queryKey: preferencesKey });
      })
      .catch((error: unknown) =>
        notify({ message: `Push konnte nicht geändert werden. ${errorMessage(error)}`, severity: "error" }),
      )
      .finally(() => setBusy(false));
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" component="h3">
        Push aufs Handy (dieses Gerät)
      </Typography>
      {state === "unsupported" &&
        (needsInstallForPush() ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            Auf iPhone und iPad funktioniert Push nur, wenn die Zentrale als App installiert ist (Teilen → Zum
            Home-Bildschirm). Öffne Aufgaben danach über das App-Symbol.
          </Alert>
        ) : (
          <Alert severity="info" sx={{ mt: 1 }}>
            Dieser Browser unterstützt keine Push-Benachrichtigungen.
          </Alert>
        ))}
      {state === "denied" && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          Benachrichtigungen sind für die Zentrale blockiert. Erlaube sie in den Browser- bzw. App-Einstellungen.
        </Alert>
      )}
      {state === "off" && (
        <Button
          variant="outlined"
          sx={{ mt: 1 }}
          disabled={busy}
          onClick={() => change(() => enablePush(userId, publicKey), "Push auf diesem Gerät aktiviert.")}
        >
          Push aktivieren
        </Button>
      )}
      {state === "on" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}>
          <Typography variant="body2">✅ Aktiv auf diesem Gerät.</Typography>
          <Button
            size="small"
            disabled={busy}
            onClick={() => change(() => disablePush(userId), "Push auf diesem Gerät deaktiviert.")}
          >
            Deaktivieren
          </Button>
        </Box>
      )}
    </Box>
  );
}
