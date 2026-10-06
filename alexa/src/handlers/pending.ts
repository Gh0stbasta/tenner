import type { HandlerInput } from "ask-sdk-core";

/** A Tenner the skill asked about. `warning` (not due yet, paused) was already said when asking. */
export interface PendingTenner {
  readonly tennerId: string;
  readonly title: string;
  readonly warning: string | null;
}

/** Open question about completing or undoing (ALEXA-004), answered by the next request. */
export type Pending =
  | { readonly kind: "confirmComplete"; readonly tenner: PendingTenner }
  | { readonly kind: "chooseTenner"; readonly options: readonly PendingTenner[] }
  | { readonly kind: "askCompletedBy"; readonly tenner: PendingTenner }
  | { readonly kind: "confirmUndo"; readonly tenner: PendingTenner };

const PENDING_ATTRIBUTE = "pending";
const LAST_COMPLETED_ATTRIBUTE = "lastCompleted";

function setAttribute(input: HandlerInput, name: string, value: unknown): void {
  const rest = Object.fromEntries(Object.entries(input.attributesManager.getSessionAttributes()).filter(([key]) => key !== name));
  input.attributesManager.setSessionAttributes(value === undefined ? rest : { ...rest, [name]: value });
}

export function setPending(input: HandlerInput, pending: Pending | undefined): void {
  setAttribute(input, PENDING_ATTRIBUTE, pending);
}

export function pendingOf(input: HandlerInput): Pending | undefined {
  return input.attributesManager.getSessionAttributes()[PENDING_ATTRIBUTE] as Pending | undefined;
}

/** The Tenner completed last in this session, for „mach das rückgängig“. */
export function setLastCompleted(input: HandlerInput, tenner: { tennerId: string; title: string } | undefined): void {
  setAttribute(input, LAST_COMPLETED_ATTRIBUTE, tenner);
}

export function lastCompletedOf(input: HandlerInput): { tennerId: string; title: string } | undefined {
  return input.attributesManager.getSessionAttributes()[LAST_COMPLETED_ATTRIBUTE] as { tennerId: string; title: string } | undefined;
}
