import type { HandlerInput } from "ask-sdk-core";

/** Open question of the current session, answered by the next request. */
export type DialogState = "AWAIT_SPEAKER";

const STATE_ATTRIBUTE = "state";

export function setDialogState(input: HandlerInput, state: DialogState | undefined): void {
  const rest = Object.fromEntries(Object.entries(input.attributesManager.getSessionAttributes()).filter(([key]) => key !== STATE_ATTRIBUTE));
  input.attributesManager.setSessionAttributes(state === undefined ? rest : { ...rest, [STATE_ATTRIBUTE]: state });
}

export function dialogStateOf(input: HandlerInput): DialogState | undefined {
  return input.attributesManager.getSessionAttributes()[STATE_ATTRIBUTE] as DialogState | undefined;
}
