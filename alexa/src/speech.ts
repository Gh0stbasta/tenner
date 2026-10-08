/**
 * German response texts of the Tenner skill (central and testable, ALEXA-001).
 * Later tickets add their texts here instead of inlining them in handlers. Dynamic values (member names, Tenner
 * titles) are XML-escaped because responses are SSML.
 */

import { escapeXmlCharacters } from "ask-sdk-core";

export const esc = (value: string): string => escapeXmlCharacters(value);

/** „Stefan“, „Stefan oder Julia“, „Stefan, Julia oder Lena“. */
export function joinAlternatives(values: readonly string[], conjunction = "oder"): string {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} ${conjunction} ${values.at(-1) ?? ""}`;
}

const EXAMPLE = "Frag mich zum Beispiel: Was ist heute fällig?";

export const SPEECH = {
  welcome: `Willkommen in der Zentrale. ${EXAMPLE}`,
  welcomeReprompt: "Was möchtest du wissen? Du kannst zum Beispiel fragen: Was ist heute fällig?",
  help:
    "Mit der Zentrale behältst du die kleinen Aufgaben im Haushalt im Blick. " +
    "Frag zum Beispiel: Was ist heute fällig? Oder sag: Stopp, um die Zentrale zu beenden.",
  helpReprompt: "Was möchtest du wissen?",
  goodbye: "Bis bald.",
  fallback: `Das habe ich leider nicht verstanden. ${EXAMPLE}`,
  fallbackReprompt: "Sag Hilfe, wenn du wissen möchtest, was ich kann.",
  error: "Entschuldige, da ist etwas schiefgelaufen. Bitte versuch es gleich noch einmal.",

  // ALEXA-002: account linking and speakers.
  linkAccount: "Bitte verknüpfe die Zentrale in der Alexa-App. Ich habe dir dort eine Karte dafür geschickt.",
  relink: "Deine Verknüpfung mit der Zentrale ist abgelaufen. Bitte verknüpfe die Zentrale in der Alexa-App neu.",
  notInHousehold: "Dieses Konto gehört zu keinem Haushalt der Zentrale. Bitte melde dich mit dem Konto an, das du in der Zentrale benutzt.",
  unavailable: "Die Zentrale ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.",
  welcomeMember: (name: string): string => `Hallo ${esc(name)}! Willkommen in der Zentrale. ${EXAMPLE}`,
  whoIsSpeaking: (names: readonly string[]): string =>
    `Willkommen in der Zentrale. Ich kenne deine Stimme noch nicht. Wer spricht gerade: ${esc(joinAlternatives(names))}?`,
  whoIsSpeakingReprompt: (names: readonly string[]): string => `Wer spricht gerade: ${esc(joinAlternatives(names))}?`,
  speakerSaved: (name: string): string => `Danke, ${esc(name)}. Ab jetzt erkenne ich dich an deiner Stimme. ${EXAMPLE}`,
  speakerNotUnderstood: (names: readonly string[]): string => `Das habe ich nicht verstanden. Bist du ${esc(joinAlternatives(names))}?`,
  // ALEXA-003 (plain text, escaped by the caller).
  unknownMember: (spoken: string, names: readonly string[]): string =>
    `Ich kenne niemanden namens ${spoken} in eurem Haushalt. Zum Haushalt gehören ${joinAlternatives(names, "und")}.`,
  // ALEXA-004 (plain text, escaped by the caller).
  completed: (title: string, nextDue: string): string => `Erledigt: ${title}. Als Nächstes fällig am ${nextDue}.`,
  rotationNext: (name: string): string => `Nächstes Mal ist ${name} dran.`,
  notDueYet: (date: string): string => `Die ist erst am ${date} fällig.`,
  pausedWarning: "Die ist pausiert; erledigen beendet die Pause.",
  confirmComplete: (title: string, warning: string | null): string => `${title} erledigen?${warning ? ` ${warning}` : ""}`,
  didYouMean: (titles: readonly string[], warning: string | null): string => `Meinst du ${joinAlternatives(titles)}?${warning ? ` ${warning}` : ""}`,
  whichTenner: "Welche Aufgabe meinst du? Sag zum Beispiel: Altglas ist erledigt.",
  noTennerFound: (spoken: string): string => `Ich habe keine Aufgabe gefunden, die wie ${spoken} klingt. Welche meinst du?`,
  whoDidIt: (title: string, names: readonly string[]): string => `Wer hat ${title} gemacht: ${joinAlternatives(names)}?`,
  nothingChanged: "Okay, ich habe nichts geändert.",
  cannotComplete: (title: string): string => `${title} ist pausiert oder archiviert und kann gerade nicht erledigt werden.`,
  tennerGone: "Diese Aufgabe gibt es nicht mehr.",
  undone: (title: string): string => `Rückgängig gemacht: ${title} ist wieder offen.`,
  confirmUndo: (title: string, name: string | undefined): string =>
    `Die letzte Erledigung heute war ${title}${name ? ` von ${name}` : ""}. Soll ich sie rückgängig machen?`,
  nothingToUndo: "Heute wurde noch nichts erledigt, das ich rückgängig machen könnte.",
  noCompletionToUndo: (title: string): string => `Für ${title} gibt es nichts mehr rückgängig zu machen.`,
  noVoiceProfile:
    "Ich kann Stimmen nur unterscheiden, wenn du in der Alexa-App ein Sprachprofil angelegt und Skills personalisieren aktiviert hast.",
} as const;

export const SKILL_TITLE = "Zentrale";
