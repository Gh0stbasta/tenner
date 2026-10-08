import { getRequestType, type HandlerInput, type RequestHandler } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { apiOf } from "../session.js";
import { TennerApiError } from "../tennerApi.js";

const PACKAGE_MANAGER = "Alexa.DataStore.PackageManager.";

/**
 * Widget installed on an Echo Show (MAINT-002, request `Alexa.DataStore.PackageManager.UsagesInstalled`, sent because
 * the package's installStateChanges is INFORM): register the Alexa account as widget target. The API write publishes
 * a HouseholdChanged event, so the notifier fills the new widget right away instead of at the next day start.
 * No speech: nobody asked anything. The Amazon user ID is never logged.
 */
export const WidgetInstalledHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return getRequestType(input.requestEnvelope) === `${PACKAGE_MANAGER}UsagesInstalled`;
  },
  async handle(input: HandlerInput): Promise<Response> {
    const requestId = input.requestEnvelope.request.requestId;
    const alexaUserId = input.requestEnvelope.context?.System?.user?.userId;
    try {
      if (alexaUserId === undefined) throw new TennerApiError("INVALID", undefined, "NO_USER");
      await apiOf(input).registerAlexaUser(alexaUserId);
      logEvent("info", "widget_installed", { requestId });
    } catch (error) {
      // Not linked or API unavailable: the widget shows „Öffnen zum Laden“ until the skill is opened once.
      logEvent("info", "widget_installed_unregistered", { requestId, reason: error instanceof TennerApiError ? error.kind : error instanceof Error ? error.name : "unknown" });
    }
    return input.responseBuilder.getResponse();
  },
};

/** Widget removed, updated or failed to install (MAINT-002): logged only; the notifier keeps pushing harmlessly. */
export const WidgetLifecycleHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    const type = getRequestType(input.requestEnvelope);
    return type === `${PACKAGE_MANAGER}UsagesRemoved` || type === `${PACKAGE_MANAGER}UpdateRequest` || type === `${PACKAGE_MANAGER}InstallationError`;
  },
  handle(input: HandlerInput): Response {
    const request = input.requestEnvelope.request as unknown as { type: string; requestId: string; error?: { type?: string } };
    const failed = request.type.endsWith("InstallationError");
    logEvent(failed ? "error" : "info", failed ? "widget_installation_error" : "widget_lifecycle", {
      requestId: request.requestId,
      requestType: request.type,
      ...(failed ? { errorType: request.error?.type ?? "unknown" } : {}),
    });
    return input.responseBuilder.getResponse();
  },
};
