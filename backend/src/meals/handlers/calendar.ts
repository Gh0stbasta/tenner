/** Calendar subscription routes (FOOD-015): token management (signed in) and the public ICS feed. */

import type { Identity } from "../../auth/index.js";
import { NotFoundError } from "../../exceptions/index.js";
import type { ApiEvent, ApiResult } from "../../types/api.js";
import { successResponse } from "../../utils/http.js";
import type { Logger } from "../../utils/logger.js";
import type { CalendarFeedStatus } from "../services/calendar-feed.service.js";

export type CalendarStatus = (tenantId: string) => Promise<CalendarFeedStatus>;
export type CreateCalendarToken = (identity: Identity) => Promise<{ readonly token: string; readonly createdAt: string }>;
export type RevokeCalendarToken = (identity: Identity) => Promise<void>;
export type CalendarFeed = (token: string) => Promise<string>;

export async function calendarStatusHandler(tenantId: string, status: CalendarStatus): Promise<ApiResult> {
  return successResponse(200, await status(tenantId));
}

/** The token is in the response only (shown once in the app); it is never logged. */
export async function createCalendarTokenHandler(identity: Identity, create: CreateCalendarToken, logger: Logger): Promise<ApiResult> {
  const created = await create(identity);
  logger.info("Calendar feed created", { event: "CalendarFeedCreated", createdBy: identity.userId });
  return successResponse(201, created);
}

export async function revokeCalendarTokenHandler(identity: Identity, revoke: RevokeCalendarToken, status: CalendarStatus, logger: Logger): Promise<ApiResult> {
  await revoke(identity);
  logger.info("Calendar feed revoked", { event: "CalendarFeedRevoked", revokedBy: identity.userId });
  return successResponse(200, await status(identity.tenantId));
}

/** Public GET /meals/calendar/{token} — the path may end in „.ics“. */
export async function calendarFeedHandler(event: ApiEvent, feed: CalendarFeed): Promise<ApiResult> {
  const raw = event.pathParameters?.token;
  if (raw === undefined || raw.length > 200) throw new NotFoundError("Calendar not found.");
  const body = await feed(raw.endsWith(".ics") ? raw.slice(0, -4) : raw);
  return {
    statusCode: 200,
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900", "content-disposition": 'inline; filename="zentrale-essen.ics"' },
    body,
  };
}
