/**
 * Alexa (ALEXA-002): voices the Tenner skill recognizes on Echo devices and the member each belongs to. A mapping is
 * created by answering „Wer spricht gerade?“ on an Echo; removing it makes Alexa ask again. No Alexa tokens are shown.
 */

import { Alert, Button, List, ListItem, ListItemText, Typography } from "@mui/material";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { useAlexaSpeakers, useUnlinkAlexaSpeaker, type AlexaContext } from "../alexa/api";
import { SettingsSection } from "./SettingsSection";

/** „Stimme von Julia“, numbered when one member has several voices (e.g. two Echo voice profiles). */
function speakerLabels(context: AlexaContext): string[] {
  const nameOf = (userId: string) => context.members.find((member) => member.userId === userId)?.displayName ?? userId;
  return context.speakers.map((speaker) => {
    const sameMember = context.speakers.filter((other) => other.userId === speaker.userId);
    const number = sameMember.length > 1 ? ` ${sameMember.indexOf(speaker) + 1}` : "";
    return `Stimme${number} von ${nameOf(speaker.userId)}`;
  });
}

export function AlexaSettings() {
  const alexa = useAlexaSpeakers();
  const unlink = useUnlinkAlexaSpeaker();
  const notify = useNotify();
  const labels = alexa.data ? speakerLabels(alexa.data) : [];

  return (
    <SettingsSection
      title="Alexa"
      description="Stimmen, die der Tenner-Skill auf euren Echo-Geräten erkennt. Eine Zuordnung entsteht, wenn jemand auf „Wer spricht gerade?“ antwortet."
    >
      {alexa.isError && <Alert severity="error">Alexa-Zuordnungen konnten nicht geladen werden. {errorMessage(alexa.error)}</Alert>}
      {alexa.data && alexa.data.speakers.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Noch keine Stimmen zugeordnet.
        </Typography>
      )}
      <List dense disablePadding aria-label="Alexa-Stimmen">
        {alexa.data?.speakers.map((speaker, index) => (
          <ListItem key={speaker.personId} disableGutters sx={{ pr: 0, gap: 1, flexWrap: "wrap" }}>
            <ListItemText primary={labels[index]} />
            <Button
              size="small"
              variant="outlined"
              disabled={unlink.isPending}
              aria-label={`Zuordnung entfernen: ${labels[index] ?? ""}`}
              onClick={() =>
                unlink.mutate(speaker.personId, {
                  onSuccess: () => notify({ message: "Zuordnung entfernt. Alexa fragt beim nächsten Mal wieder nach." }),
                  onError: (error) => notify({ message: `Entfernen fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
                })
              }
            >
              Zuordnung entfernen
            </Button>
          </ListItem>
        ))}
      </List>
    </SettingsSection>
  );
}
