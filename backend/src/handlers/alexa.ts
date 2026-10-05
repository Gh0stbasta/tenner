/** GET /household/alexa and PUT/DELETE /household/alexa-speakers/{personId} (ALEXA-002). */

import type { Identity } from "../auth/index.js";
import type { AlexaContextResponse } from "../dto/index.js";
import type { UserId } from "../models/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { alexaPersonIdSchema, linkAlexaSpeakerSchema, parseJsonBody, validate } from "../validators/index.js";

export type GetAlexaContext = (identity: Identity) => Promise<AlexaContextResponse>;
export type LinkAlexaSpeaker = (identity: Identity, personId: string, userId: UserId) => Promise<AlexaContextResponse>;
export type UnlinkAlexaSpeaker = (identity: Identity, personId: string) => Promise<AlexaContextResponse>;

export async function alexaContextHandler(identity: Identity, getContext: GetAlexaContext): Promise<ApiResult> {
  return successResponse(200, await getContext(identity));
}

// Logs carry the member only: person IDs are Amazon identifiers and stay out of the logs (ALEXA-009 privacy rule).
export async function linkAlexaSpeakerHandler(event: ApiEvent, identity: Identity, link: LinkAlexaSpeaker, logger: Logger): Promise<ApiResult> {
  const personId = validate(alexaPersonIdSchema, event.pathParameters?.personId);
  const request = validate(linkAlexaSpeakerSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const context = await link(identity, personId, request.userId);
  logger.info("Alexa speaker mapped", { event: "AlexaSpeakerMapped", userId: request.userId, mappedBy: identity.userId });
  return successResponse(200, context);
}

export async function unlinkAlexaSpeakerHandler(event: ApiEvent, identity: Identity, unlink: UnlinkAlexaSpeaker, logger: Logger): Promise<ApiResult> {
  const personId = validate(alexaPersonIdSchema, event.pathParameters?.personId);
  const context = await unlink(identity, personId);
  logger.info("Alexa speaker mapping removed", { event: "AlexaSpeakerUnmapped", removedBy: identity.userId });
  return successResponse(200, context);
}
