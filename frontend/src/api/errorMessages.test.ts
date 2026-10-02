import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";
import { DEFAULT_ERROR_MESSAGE, errorMessage, UNREACHABLE_MESSAGE } from "./errorMessages";

describe("errorMessage", () => {
  it.each([
    ["VALIDATION_ERROR", 400, "Bitte prüfe die markierten Eingaben."],
    ["NOT_FOUND", 404, "Dieser Tenner existiert nicht mehr."],
    [
      "CONCURRENT_MODIFICATION",
      409,
      "Jemand anderes hat diesen Tenner geändert. Lade neu, um den aktuellen Stand zu sehen.",
    ],
    ["TENNER_INACTIVE", 409, "Dieser Tenner ist inaktiv."],
    ["NO_COMPLETION_TO_UNDO", 409, "Es gibt keine Erledigung, die zurückgenommen werden kann."],
    ["TENNER_NOT_DELETED", 409, "Dieser Tenner ist nicht archiviert."],
    ["IDEMPOTENCY_KEY_REUSED", 409, "Diese Aktion wurde bereits mit anderen Daten ausgeführt. Bitte lade neu."],
    ["API_NOT_CONFIGURED", 0, "Die App ist nicht richtig eingerichtet: die API-Adresse fehlt."],
    ["INVALID_RESPONSE", 200, "Unerwartete Antwort vom Server. Bitte lade die Seite neu."],
    ["TOO_MANY_REQUESTS", 429, "Gerade kommen zu viele Anfragen an. Bitte warte einen Moment."],
    ["INTERNAL_ERROR", 500, UNREACHABLE_MESSAGE],
    ["NETWORK_ERROR", 0, UNREACHABLE_MESSAGE],
    ["UNKNOWN", 400, DEFAULT_ERROR_MESSAGE],
  ])("%s (%i)", (code, status, message) => {
    expect(errorMessage(new ApiError(status, code, "x"))).toBe(message);
  });

  it("uses the fallback for non-API errors", () => {
    expect(errorMessage(new Error("boom"), "Eigener Text")).toBe("Eigener Text");
    expect(errorMessage(undefined)).toBe(DEFAULT_ERROR_MESSAGE);
  });
});
