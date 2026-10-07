/** Central mapping from API errors to user messages (UX-005). */

import { CLIENT_ERROR_CODES, isApiError } from "./errors";

export const DEFAULT_ERROR_MESSAGE = "Bitte versuche es erneut.";
export const UNREACHABLE_MESSAGE = "Tenner ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.";

const MESSAGES: Readonly<Record<string, string>> = {
  VALIDATION_ERROR: "Bitte prüfe die markierten Eingaben.",
  UNAUTHORIZED: "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.",
  NOT_FOUND: "Dieser Tenner existiert nicht mehr.",
  CONCURRENT_MODIFICATION: "Jemand anderes hat diesen Tenner geändert. Lade neu, um den aktuellen Stand zu sehen.",
  TENNER_INACTIVE: "Dieser Tenner ist inaktiv.",
  NO_COMPLETION_TO_UNDO: "Es gibt keine Erledigung, die zurückgenommen werden kann.",
  TENNER_NOT_DELETED: "Dieser Tenner ist nicht archiviert.",
  MEMBER_TAKEN: "Diese Person ist schon mit einem anderen Konto verknüpft.",
  ALREADY_ASSIGNED: "Dein Konto ist bereits verknüpft. Du wirst gleich weitergeleitet.",
  CATALOG_MEMBERS_MISSING: "Der Aufgabenkatalog braucht die Mitglieder Stefan und Julia (IDs STEFAN, JULIA).",
  NO_ALTERNATIVE: "Kein anderes Gericht passt in diese Woche.",
  MEAL_IN_PAST: "Vergangene Mahlzeiten lassen sich nicht mehr ändern.",
  RULE_VIOLATION: "Das Gericht passt nicht zu euren Regeln.",
  IDEMPOTENCY_KEY_REUSED: "Diese Aktion wurde bereits mit anderen Daten ausgeführt. Bitte lade neu.",
  [CLIENT_ERROR_CODES.notConfigured]: "Die App ist nicht richtig eingerichtet: die API-Adresse fehlt.",
  [CLIENT_ERROR_CODES.invalidResponse]: "Unerwartete Antwort vom Server. Bitte lade die Seite neu.",
};

/** A German message for any error; `fallback` for unknown errors. */
export function errorMessage(error: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  if (!isApiError(error)) return fallback;
  const known = MESSAGES[error.code];
  if (known) return known;
  // API Gateway answers 401 without the envelope (JWT authorizer).
  if (error.status === 401) return MESSAGES.UNAUTHORIZED ?? fallback;
  if (error.status === 429) return "Gerade kommen zu viele Anfragen an. Bitte warte einen Moment.";
  if (error.isTransient) return UNREACHABLE_MESSAGE;
  return fallback;
}
