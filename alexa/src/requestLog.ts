/**
 * One structured log line per skill request (ALEXA-009): request type, intent, locale, device class, duration,
 * Tenner API calls and outcome. Never tokens, user/person IDs or titles. CloudWatch metric filters count the
 * outcomes (terraform/alexa-monitoring.tf).
 */

import { getIntentName, getRequestType, getViewportProfile, type HandlerInput, type RequestInterceptor, type ResponseInterceptor } from "ask-sdk-core";
import type { Response } from "ask-sdk-model";
import { logEvent } from "./log.js";

export type Outcome = "ANSWERED" | "ASKED" | "COMPLETED" | "LINK_REQUIRED" | "ERROR";

interface RequestMetrics {
  startedAt?: number;
  outcome?: Outcome;
  apiCalls?: number;
  apiMs?: number;
  apiStatus?: number;
  logged?: boolean;
}

const metricsOf = (input: HandlerInput): RequestMetrics => input.attributesManager.getRequestAttributes() as RequestMetrics;

export const startTimer: RequestInterceptor = {
  process(input: HandlerInput): void {
    metricsOf(input).startedAt = Date.now();
  },
};

/** Called by the Tenner API client after every call (status 0 = network error or timeout). */
export function recordApiCall(input: HandlerInput, status: number, durationMs: number): void {
  const metrics = metricsOf(input);
  metrics.apiCalls = (metrics.apiCalls ?? 0) + 1;
  metrics.apiMs = (metrics.apiMs ?? 0) + durationMs;
  metrics.apiStatus = status;
}

/** Handlers with a specific result (e.g. a completion) set it; otherwise it is derived from the response. */
export function setOutcome(input: HandlerInput, outcome: Outcome): void {
  metricsOf(input).outcome = outcome;
}

const deviceClass = (input: HandlerInput): string => {
  try {
    return input.requestEnvelope.context?.Viewport ? String(getViewportProfile(input.requestEnvelope)) : "VOICE";
  } catch {
    return "UNKNOWN";
  }
};

export function logRequest(input: HandlerInput, response: Response | undefined, outcome?: Outcome): void {
  const metrics = metricsOf(input);
  if (metrics.logged) return;
  metrics.logged = true;
  const envelope = input.requestEnvelope;
  const type = getRequestType(envelope);
  const final = outcome ?? metrics.outcome ?? (response?.reprompt ? "ASKED" : "ANSWERED");
  logEvent(final === "ERROR" ? "error" : "info", "skill_request", {
    requestId: envelope.request.requestId,
    requestType: type,
    intent: type === "IntentRequest" ? getIntentName(envelope) : undefined,
    locale: envelope.request.locale,
    device: deviceClass(input),
    durationMs: metrics.startedAt === undefined ? undefined : Date.now() - metrics.startedAt,
    apiCalls: metrics.apiCalls ?? 0,
    apiMs: metrics.apiMs,
    apiStatus: metrics.apiStatus,
    outcome: final,
  });
}

export const logResponse: ResponseInterceptor = {
  process(input: HandlerInput, response?: Response): void {
    logRequest(input, response);
  },
};
