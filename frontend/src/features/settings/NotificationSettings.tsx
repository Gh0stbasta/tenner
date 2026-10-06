/**
 * Notifications (NOTIFICATION-002): personal, stored on the server for the notifier. Every change is saved at once.
 * Channels can only be chosen once connected; connection flows come with the channel tickets.
 */

import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { WEEKDAYS, type Weekday } from "../../types/domain";
import { useCurrentUser } from "../completions/CurrentUserProvider";
import {
  CHANNEL_LABELS,
  QUARTER_HOURS,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationPreferences,
  type UserChannel,
} from "../notifications/api";
import { NumberSetting } from "./NumberSetting";
import { SettingsSection } from "./SettingsSection";

const DAY_NAMES: Record<Weekday, string> = {
  MON: "Montag",
  TUE: "Dienstag",
  WED: "Mittwoch",
  THU: "Donnerstag",
  FRI: "Freitag",
  SAT: "Samstag",
  SUN: "Sonntag",
};

function TimeSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (time: string) => void;
  disabled: boolean;
}) {
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      sx={{ minWidth: 140 }}
    >
      {QUARTER_HOURS.map((time) => (
        <MenuItem key={time} value={time}>
          {time}
        </MenuItem>
      ))}
    </TextField>
  );
}

function Block({
  title,
  enabled,
  onToggle,
  disabled,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <FormControlLabel
        control={<Switch checked={enabled} onChange={(event) => onToggle(event.target.checked)} disabled={disabled} />}
        label={title}
      />
      {enabled && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 1, alignItems: "flex-start" }}>{children}</Box>
      )}
    </Box>
  );
}

function Channels({
  label,
  chosen,
  connected,
  onChange,
  disabled,
}: {
  label: string;
  chosen: readonly UserChannel[];
  connected: readonly UserChannel[];
  onChange: (channels: UserChannel[]) => void;
  disabled: boolean;
}) {
  if (connected.length === 0) return null;
  return (
    <FormGroup row role="group" aria-label={label}>
      {connected.map((channel) => (
        <FormControlLabel
          key={channel}
          label={CHANNEL_LABELS[channel]}
          control={
            <Checkbox
              checked={chosen.includes(channel)}
              disabled={disabled}
              onChange={(event) =>
                onChange(event.target.checked ? [...chosen, channel] : chosen.filter((other) => other !== channel))
              }
            />
          }
        />
      ))}
    </FormGroup>
  );
}

export function NotificationSettings() {
  const userId = useCurrentUser();
  const query = useNotificationPreferences(userId);
  const update = useUpdateNotificationPreferences(userId);
  const notify = useNotify();
  const preferences = update.isPending ? update.variables : query.data?.preferences;
  const connected = (query.data?.channels ?? []).filter((channel) => channel.connected).map((channel) => channel.type);
  const disabled = !query.data || update.isPending;

  const save = (changes: Partial<NotificationPreferences>) => {
    if (!preferences) return;
    update.mutate(
      { ...preferences, ...changes },
      {
        onError: (error) => notify({ message: `Speichern fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
      },
    );
  };

  return (
    <SettingsSection
      title="Benachrichtigungen"
      description="Nur für dich. Zeiten gelten in deiner Zeitzone, Benachrichtigungen kommen in 15-Minuten-Schritten."
    >
      {query.isError && (
        <Alert severity="error">Benachrichtigungen konnten nicht geladen werden. {errorMessage(query.error)}</Alert>
      )}
      {preferences && (
        <>
          {connected.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Noch kein Kanal verbunden. Sobald z. B. Alexa verbunden ist, kannst du hier auswählen, wohin
              Benachrichtigungen gehen.
            </Alert>
          )}
          <Block
            title="Tagesüberblick"
            enabled={preferences.dailyDigest.enabled}
            disabled={disabled}
            onToggle={(enabled) => save({ dailyDigest: { ...preferences.dailyDigest, enabled } })}
          >
            <TimeSelect
              label="Uhrzeit"
              value={preferences.dailyDigest.time}
              disabled={disabled}
              onChange={(time) => save({ dailyDigest: { ...preferences.dailyDigest, time } })}
            />
            <Channels
              label="Kanäle für den Tagesüberblick"
              chosen={preferences.dailyDigest.channels}
              connected={connected}
              disabled={disabled}
              onChange={(channels) => save({ dailyDigest: { ...preferences.dailyDigest, channels } })}
            />
          </Block>
          <Block
            title="Überfällig-Hinweise"
            enabled={preferences.overdueAlerts.enabled}
            disabled={disabled}
            onToggle={(enabled) => save({ overdueAlerts: { ...preferences.overdueAlerts, enabled } })}
          >
            <Box sx={{ width: 220 }}>
              <NumberSetting
                label="Ab Tagen überfällig"
                value={preferences.overdueAlerts.minDaysOverdue}
                range={{ min: 0, max: 30 }}
                disabled={disabled}
                onSave={(minDaysOverdue) => save({ overdueAlerts: { ...preferences.overdueAlerts, minDaysOverdue } })}
              />
            </Box>
            <Channels
              label="Kanäle für Überfällig-Hinweise"
              chosen={preferences.overdueAlerts.channels}
              connected={connected}
              disabled={disabled}
              onChange={(channels) => save({ overdueAlerts: { ...preferences.overdueAlerts, channels } })}
            />
          </Block>
          <Block
            title="Wochenrückblick"
            enabled={preferences.weeklySummary.enabled}
            disabled={disabled}
            onToggle={(enabled) => save({ weeklySummary: { ...preferences.weeklySummary, enabled } })}
          >
            <TextField
              select
              label="Tag"
              value={preferences.weeklySummary.dayOfWeek}
              disabled={disabled}
              sx={{ minWidth: 160 }}
              onChange={(event) =>
                save({ weeklySummary: { ...preferences.weeklySummary, dayOfWeek: event.target.value as Weekday } })
              }
            >
              {WEEKDAYS.map((day) => (
                <MenuItem key={day} value={day}>
                  {DAY_NAMES[day]}
                </MenuItem>
              ))}
            </TextField>
            <TimeSelect
              label="Uhrzeit"
              value={preferences.weeklySummary.time}
              disabled={disabled}
              onChange={(time) => save({ weeklySummary: { ...preferences.weeklySummary, time } })}
            />
            <Channels
              label="Kanäle für den Wochenrückblick"
              chosen={preferences.weeklySummary.channels}
              connected={connected}
              disabled={disabled}
              onChange={(channels) => save({ weeklySummary: { ...preferences.weeklySummary, channels } })}
            />
          </Block>
          <Block
            title="Ruhezeit"
            enabled={preferences.quietHours !== null}
            disabled={disabled}
            onToggle={(enabled) => save({ quietHours: enabled ? { start: "21:30", end: "07:00" } : null })}
          >
            {preferences.quietHours && (
              <>
                <TimeSelect
                  label="Ruhezeit von"
                  value={preferences.quietHours.start}
                  disabled={disabled}
                  onChange={(start) =>
                    preferences.quietHours && save({ quietHours: { ...preferences.quietHours, start } })
                  }
                />
                <TimeSelect
                  label="Ruhezeit bis"
                  value={preferences.quietHours.end}
                  disabled={disabled}
                  onChange={(end) => preferences.quietHours && save({ quietHours: { ...preferences.quietHours, end } })}
                />
              </>
            )}
          </Block>
          {query.data && (
            <Typography variant="body2" color="text.secondary">
              Zeitzone: {query.data.effectiveTimezone}
            </Typography>
          )}
        </>
      )}
    </SettingsSection>
  );
}
