/**
 * German response texts of the Tenner skill (central and testable, ALEXA-001).
 * Later tickets add their texts here instead of inlining them in handlers.
 */

export const SPEECH = {
  welcome: "Willkommen bei Tenner. Frag mich zum Beispiel: Was ist heute fällig?",
  welcomeReprompt: "Was möchtest du wissen? Du kannst zum Beispiel fragen: Was ist heute fällig?",
  help:
    "Mit Tenner behältst du die kleinen Aufgaben im Haushalt im Blick. " +
    "Frag zum Beispiel: Was ist heute fällig? Oder sag: Stopp, um Tenner zu beenden.",
  helpReprompt: "Was möchtest du wissen?",
  goodbye: "Bis bald.",
  fallback: "Das habe ich leider nicht verstanden. Frag zum Beispiel: Was ist heute fällig?",
  fallbackReprompt: "Sag Hilfe, wenn du wissen möchtest, was ich kann.",
  error: "Entschuldige, da ist etwas schiefgelaufen. Bitte versuch es gleich noch einmal.",
} as const;

export const SKILL_TITLE = "Tenner";
