/**
 * Echo Show rendering (ALEXA-006). Only devices with the APL interface get documents; the session remembers which
 * dashboard is on screen so a completion can refresh it. While a document is shown the session stays open without
 * an open microphone (no reprompt, shouldEndSession unset).
 */

import type { HandlerInput } from "ask-sdk-core";
import dashboardDocument from "../../apl/dashboard.json" with { type: "json" };
import listDocument from "../../apl/list.json" with { type: "json" };
import { dashboardView, overdueListView, supportsApl } from "../apl.js";
import { fetchDashboard, type Dashboard } from "../dashboard.js";
import { apiOf } from "../session.js";
import type { AlexaMember } from "../tennerApi.js";

export const DASHBOARD_TOKEN = "tenner-dashboard";
export const LIST_TOKEN = "tenner-list";
const SCREEN_ATTRIBUTE = "screen";

interface ScreenState {
  /** Member filter of the dashboard on screen; null = household-wide. */
  readonly assignedTo: string | null;
}

export function screenOf(input: HandlerInput): ScreenState | undefined {
  return input.attributesManager.getSessionAttributes()[SCREEN_ATTRIBUTE] as ScreenState | undefined;
}

function remember(input: HandlerInput, state: ScreenState): void {
  input.attributesManager.setSessionAttributes({ ...input.attributesManager.getSessionAttributes(), [SCREEN_ATTRIBUTE]: state });
}

export const hasScreen = (input: HandlerInput): boolean => supportsApl(input.requestEnvelope);

/** Render the dashboard (no-op on voice-only devices). */
export function renderDashboard(input: HandlerInput, dashboard: Dashboard, members: readonly AlexaMember[], assignedTo: string | undefined, banner = ""): void {
  if (!hasScreen(input)) return;
  input.responseBuilder.addDirective({
    type: "Alexa.Presentation.APL.RenderDocument",
    token: DASHBOARD_TOKEN,
    document: dashboardDocument,
    datasources: { payload: { view: dashboardView(dashboard, members, banner) } },
  });
  remember(input, { assignedTo: assignedTo ?? null });
}

/** Render the overdue list (no-op on voice-only devices). */
export function renderOverdueList(input: HandlerInput, dashboard: Dashboard, members: readonly AlexaMember[], assignedTo: string | undefined): void {
  if (!hasScreen(input)) return;
  input.responseBuilder.addDirective({
    type: "Alexa.Presentation.APL.RenderDocument",
    token: LIST_TOKEN,
    document: listDocument,
    datasources: { payload: { view: overdueListView(dashboard, members) } },
  });
  remember(input, { assignedTo: assignedTo ?? null });
}

/** After a completion: show the confirmation banner on a fresh dashboard, if a screen is in use this session. */
export async function refreshAfterCompletion(input: HandlerInput, members: readonly AlexaMember[], banner: string): Promise<void> {
  const screen = screenOf(input);
  if (!hasScreen(input) || screen === undefined) return;
  const assignedTo = screen.assignedTo ?? undefined;
  renderDashboard(input, await fetchDashboard(apiOf(input), assignedTo), members, assignedTo, banner);
}
