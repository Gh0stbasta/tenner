/**
 * GET/PUT /users/{userId}/notification-preferences (NOTIFICATION-002) and PUT/DELETE /users/{userId}/push-subscription
 * (NOTIFICATION-009). Addresses and push endpoints are never logged.
 */

import type { Identity } from "../auth/index.js";
import type { NotificationPreferencesResponse, PushSubscriptionRequest, PushSubscriptionResponse, UpdateNotificationPreferencesRequest } from "../dto/index.js";
import type { UserId } from "../models/index.js";
import type { ApiEvent, ApiResult } from "../types/api.js";
import { successResponse } from "../utils/http.js";
import type { Logger } from "../utils/logger.js";
import { notificationPreferencesSchema, parseJsonBody, pushSubscriptionSchema, removePushSubscriptionSchema, userIdSchema, validate } from "../validators/index.js";

export type GetNotificationPreferences = (identity: Identity, userId: UserId) => Promise<NotificationPreferencesResponse>;
export type UpdateNotificationPreferences = (identity: Identity, userId: UserId, request: UpdateNotificationPreferencesRequest) => Promise<NotificationPreferencesResponse>;

export async function getNotificationPreferencesHandler(event: ApiEvent, identity: Identity, get: GetNotificationPreferences): Promise<ApiResult> {
  return successResponse(200, await get(identity, validate(userIdSchema, event.pathParameters?.userId)));
}

export async function updateNotificationPreferencesHandler(event: ApiEvent, identity: Identity, update: UpdateNotificationPreferences, logger: Logger): Promise<ApiResult> {
  const userId = validate(userIdSchema, event.pathParameters?.userId);
  const request = validate(notificationPreferencesSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const result = await update(identity, userId, request);
  logger.info("Notification preferences changed", {
    event: "NotificationPreferencesChanged",
    userId,
    dailyDigest: request.dailyDigest.enabled,
    overdueAlerts: request.overdueAlerts.enabled,
    weeklySummary: request.weeklySummary.enabled,
  });
  return successResponse(200, result);
}

export type SubscribePush = (identity: Identity, userId: UserId, request: PushSubscriptionRequest) => Promise<number>;
export type UnsubscribePush = (identity: Identity, userId: UserId, endpoint: string) => Promise<void>;

export async function subscribePushHandler(event: ApiEvent, identity: Identity, subscribe: SubscribePush, logger: Logger): Promise<ApiResult> {
  const userId = validate(userIdSchema, event.pathParameters?.userId);
  const request = validate(pushSubscriptionSchema, parseJsonBody(event.body, event.isBase64Encoded));
  const devices = await subscribe(identity, userId, request);
  logger.info("Push device registered", { event: "PushSubscribed", userId, devices, pushService: new URL(request.endpoint).hostname });
  return successResponse(200, { devices } satisfies PushSubscriptionResponse);
}

export async function unsubscribePushHandler(event: ApiEvent, identity: Identity, unsubscribe: UnsubscribePush, logger: Logger): Promise<ApiResult> {
  const userId = validate(userIdSchema, event.pathParameters?.userId);
  const { endpoint } = validate(removePushSubscriptionSchema, parseJsonBody(event.body, event.isBase64Encoded));
  await unsubscribe(identity, userId, endpoint);
  logger.info("Push device removed", { event: "PushUnsubscribed", userId });
  return successResponse(200, {});
}
