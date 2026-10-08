/**
 * Voice completion and undo (ALEXA-004). Never completes without a clear match: uncertain matches, Tenners that
 * are not due yet and paused Tenners are confirmed first; the completing member is the recognized speaker or asked.
 */

import type { HandlerInput, RequestHandler } from "ask-sdk-core";
import type { IntentRequest, Response } from "ask-sdk-model";
import { logEvent } from "../log.js";
import { setOutcome } from "../requestLog.js";
import { findMemberByName, apiOf, loadHousehold, type Household } from "../session.js";
import { matchTenner, type MatchCandidate } from "../matcher.js";
import { SPEECH } from "../speech.js";
import { SHARED_ASSIGNEE } from "../dashboard.js";
import { TennerApiError } from "../tennerApi.js";
import { completeTenner, dateIn, fetchTenners, latestCompletion, spokenDate, undoCompletion, type TennerSummary } from "../tenners.js";
import { isIntent } from "./intentRequest.js";
import { memberFromSlot } from "./members.js";
import { lastCompletedOf, pendingOf, setLastCompleted, setPending, type PendingTenner } from "./pending.js";
import { suggestedTennerId } from "./questions.js";
import { answer } from "./respond.js";

const requestIdOf = (input: HandlerInput): string => input.requestEnvelope.request.requestId;

function slotValue(input: HandlerInput, slot: string): { value: string | undefined; id: string | undefined } {
  const filled = (input.requestEnvelope.request as IntentRequest).intent.slots?.[slot];
  const resolved = filled?.resolutions?.resolutionsPerAuthority?.find((authority) => authority.status.code === "ER_SUCCESS_MATCH");
  return { value: filled?.value || undefined, id: resolved?.values[0]?.value.id };
}

/** Text the user said in answer to a question, whichever slot the NLU filled. */
const spokenAnswer = (input: HandlerInput): string | undefined => slotValue(input, "tenner").value ?? slotValue(input, "member").value;

/** Not due yet or paused → said before completing. */
function warningOf(tenner: TennerSummary, today: string): string | null {
  if (tenner.pausedAt !== null) return SPEECH.pausedWarning;
  if (tenner.nextDue > today) return SPEECH.notDueYet(spokenDate(tenner.nextDue));
  return null;
}

const toPending = (tenner: TennerSummary, today: string): PendingTenner => ({ tennerId: tenner.tennerId, title: tenner.title, warning: warningOf(tenner, today) });

/** Ask a yes/no or choice question and remember what it was about. */
function ask(input: HandlerInput, text: string): Response {
  return answer(input, text, text);
}

/** Step 2: who did it — the recognized speaker, the only member, or ask. */
export async function completeBy(input: HandlerInput, household: Household, tenner: PendingTenner): Promise<Response> {
  const members = household.context.members;
  const completedBy = household.speaker?.userId ?? (members.length === 1 ? members[0]?.userId : undefined);
  if (completedBy === undefined) {
    setPending(input, { kind: "askCompletedBy", tenner });
    return ask(input, SPEECH.whoDidIt(tenner.title, members.map((member) => member.displayName)));
  }
  return finishComplete(input, household, tenner, completedBy);
}

/** Step 3: complete via the API and say what comes next. */
async function finishComplete(input: HandlerInput, household: Household, tenner: PendingTenner, completedBy: string): Promise<Response> {
  setPending(input, undefined);
  try {
    const result = await completeTenner(apiOf(input), tenner.tennerId, completedBy, requestIdOf(input));
    setLastCompleted(input, { tennerId: tenner.tennerId, title: tenner.title });
    setOutcome(input, "COMPLETED");
    logEvent("info", "tenner_completed", { requestId: requestIdOf(input), tennerId: tenner.tennerId });
    const next = result.tenner;
    const nextMember = household.context.members.find((member) => member.userId === next.assignedTo);
    const rotation = next.assignmentMode === "ROTATING" && next.assignedTo !== SHARED_ASSIGNEE && next.assignedTo !== completedBy && nextMember ? ` ${SPEECH.rotationNext(nextMember.displayName)}` : "";
    return answer(input, `${SPEECH.completed(tenner.title, spokenDate(next.nextDue))}${rotation}`);
  } catch (error) {
    if (error instanceof TennerApiError && error.code === "TENNER_INACTIVE") return answer(input, SPEECH.cannotComplete(tenner.title));
    if (error instanceof TennerApiError && error.kind === "NOT_FOUND") return answer(input, SPEECH.tennerGone);
    throw error;
  }
}

/** Step 1 for a clearly identified Tenner: confirm a warning, else go on. */
async function startComplete(input: HandlerInput, household: Household, tenner: PendingTenner): Promise<Response> {
  if (tenner.warning !== null) {
    setPending(input, { kind: "confirmComplete", tenner });
    return ask(input, SPEECH.confirmComplete(tenner.title, tenner.warning));
  }
  return completeBy(input, household, tenner);
}

/** Match the spoken title against `candidates`; clear → complete, unsure → ask, nothing → ask again. */
async function matchAndComplete(input: HandlerInput, household: Household, spoken: string, candidates: readonly TennerSummary[], today: string): Promise<Response> {
  const speakerId = household.speaker?.userId;
  const forSpeaker = (tenner: TennerSummary) => speakerId === undefined || tenner.assignedTo === speakerId || tenner.assignedTo === SHARED_ASSIGNEE;
  const matchCandidates: MatchCandidate[] = candidates.map((tenner) => ({ tennerId: tenner.tennerId, title: tenner.title, due: tenner.nextDue <= today && forSpeaker(tenner) }));
  const result = matchTenner(spoken, matchCandidates);
  const byId = (id: string) => candidates.find((tenner) => tenner.tennerId === id) as TennerSummary;
  logEvent("info", "tenner_match", { requestId: requestIdOf(input), outcome: result.kind, score: Math.round(result.score * 100) / 100, tennerId: result.kind === "clear" ? result.tenner.tennerId : undefined });
  if (result.kind === "clear") return startComplete(input, household, toPending(byId(result.tenner.tennerId), today));
  if (result.kind === "none") {
    setPending(input, undefined);
    return ask(input, SPEECH.noTennerFound(spoken));
  }
  const options = result.options.map((option) => toPending(byId(option.tennerId), today));
  if (options.length === 1 && options[0]) {
    // One uncertain candidate: „Meinst du …?“ — „ja“ completes, so its warning is said now.
    setPending(input, { kind: "confirmComplete", tenner: options[0] });
    return ask(input, SPEECH.didYouMean([options[0].title], options[0].warning));
  }
  setPending(input, { kind: "chooseTenner", options });
  return ask(input, SPEECH.didYouMean(options.map((option) => option.title), null));
}

/** „Altglas ist erledigt“, „erledigt“ (after a suggestion), and answers while choosing between Tenners. */
export const CompleteIntentHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    const pending = pendingOf(input)?.kind;
    return isIntent(input, "CompleteIntent") || (isIntent(input, "SpeakerIntent") && pending === "chooseTenner");
  },
  async handle(input: HandlerInput): Promise<Response> {
    const household = await loadHousehold(input);
    const today = dateIn(household.context.timezone);
    const pending = pendingOf(input);
    const { value, id } = slotValue(input, "tenner");
    const spoken = value ?? (pending?.kind === "chooseTenner" ? spokenAnswer(input) : undefined);
    const tenners = await fetchTenners(apiOf(input));

    if (pending?.kind === "chooseTenner" && spoken !== undefined) {
      const options = tenners.filter((tenner) => pending.options.some((option) => option.tennerId === tenner.tennerId));
      return matchAndComplete(input, household, spoken, options, today);
    }
    const resolved = id === undefined ? undefined : tenners.find((tenner) => tenner.tennerId === id);
    if (resolved) return startComplete(input, household, toPending(resolved, today));
    if (spoken !== undefined) return matchAndComplete(input, household, spoken, tenners, today);

    // „erledigt“ without a title: the Tenner suggested in this session (ALEXA-003).
    const suggested = tenners.find((tenner) => tenner.tennerId === suggestedTennerId(input));
    if (suggested) return startComplete(input, household, toPending(suggested, today));
    return ask(input, SPEECH.whichTenner);
  },
};

/** Answer to „Wer hat … gemacht?“ (the NLU may route a bare name to SpeakerIntent or CompleteIntent). */
export const CompletedByAnswerHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return pendingOf(input)?.kind === "askCompletedBy" && isIntent(input, "SpeakerIntent", "CompleteIntent");
  },
  async handle(input: HandlerInput): Promise<Response> {
    const pending = pendingOf(input);
    if (pending?.kind !== "askCompletedBy") return answer(input, SPEECH.nothingChanged);
    const household = await loadHousehold(input);
    const members = household.context.members;
    const spoken = spokenAnswer(input);
    const member = memberFromSlot(input, "member", members) ?? (spoken === undefined ? undefined : findMemberByName(members, spoken));
    if (member === undefined) return ask(input, SPEECH.whoDidIt(pending.tenner.title, members.map((candidate) => candidate.displayName)));
    return finishComplete(input, household, pending.tenner, member.userId);
  },
};

/** „mach das rückgängig“: the session's last completion directly, else the latest one today after asking. */
export const UndoIntentHandler: RequestHandler = {
  canHandle: (input) => isIntent(input, "UndoIntent"),
  async handle(input: HandlerInput): Promise<Response> {
    const last = lastCompletedOf(input);
    if (last) return finishUndo(input, { ...last, warning: null });
    const household = await loadHousehold(input);
    const latest = await latestCompletion(apiOf(input), household.speaker?.userId);
    const today = dateIn(household.context.timezone);
    if (latest === undefined || dateIn(household.context.timezone, new Date(latest.completedAt)) !== today) return answer(input, SPEECH.nothingToUndo);
    const title = latest.tennerTitle ?? "dieser Tenner";
    const by = household.speaker === undefined ? household.context.members.find((member) => member.userId === latest.completedBy)?.displayName : undefined;
    setPending(input, { kind: "confirmUndo", tenner: { tennerId: latest.tennerId, title, warning: null } });
    return ask(input, SPEECH.confirmUndo(title, by));
  },
};

async function finishUndo(input: HandlerInput, tenner: PendingTenner): Promise<Response> {
  setPending(input, undefined);
  try {
    await undoCompletion(apiOf(input), tenner.tennerId, requestIdOf(input));
    setLastCompleted(input, undefined);
    logEvent("info", "completion_undone", { requestId: requestIdOf(input), tennerId: tenner.tennerId });
    return answer(input, SPEECH.undone(tenner.title));
  } catch (error) {
    if (error instanceof TennerApiError && (error.code === "NO_COMPLETION_TO_UNDO" || error.code === "TENNER_INACTIVE")) {
      setLastCompleted(input, undefined);
      return answer(input, SPEECH.noCompletionToUndo(tenner.title));
    }
    throw error;
  }
}

/** „ja“ to a completion or undo question. */
export const ConfirmYesHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    const kind = pendingOf(input)?.kind;
    return isIntent(input, "AMAZON.YesIntent") && (kind === "confirmComplete" || kind === "confirmUndo");
  },
  async handle(input: HandlerInput): Promise<Response> {
    const pending = pendingOf(input);
    if (pending?.kind === "confirmUndo") return finishUndo(input, pending.tenner);
    if (pending?.kind !== "confirmComplete") return answer(input, SPEECH.nothingChanged);
    return completeBy(input, await loadHousehold(input), pending.tenner);
  },
};

/** „nein“ (or „abbrechen“) to any open completion question. */
export const ConfirmNoHandler: RequestHandler = {
  canHandle(input: HandlerInput): boolean {
    return pendingOf(input) !== undefined && isIntent(input, "AMAZON.NoIntent", "AMAZON.CancelIntent");
  },
  handle(input: HandlerInput): Response {
    setPending(input, undefined);
    return answer(input, SPEECH.nothingChanged);
  },
};
