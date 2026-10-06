/**
 * Lambda entry point of the notifier (function tenner-notifier, NOTIFICATION-001). Invoked every 15 minutes by an
 * EventBridge schedule; runs the notification jobs for the household and delivers through the configured channels.
 */

import { getDocumentClient } from "./clients/dynamodb.js";
import { loadConfig, type AppConfig } from "./config.js";
import { LogChannel, runNotifier, type NotificationChannel, type NotificationJob, type NotifierDependencies, type RunSummary } from "./notifications/index.js";
import { DynamoDbDeliveryLog, DynamoDbHouseholdRepository } from "./repositories/index.js";
import { HouseholdService, MemberService } from "./services/index.js";
import { systemClock } from "./utils/clock.js";
import { createLogger } from "./utils/logger.js";

export class NotifierNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`Notifier is not configured: ${missing} missing.`);
    this.name = "NotifierNotConfiguredError";
  }
}

/** Jobs and channels are added by the content and channel tickets (NOTIFICATION-003/004, ALEXA-008). */
export interface NotifierExtensions {
  readonly jobs: readonly NotificationJob[];
  readonly channels: readonly NotificationChannel[];
}

export function createNotifierDependencies(config: AppConfig = loadConfig(), extensions?: NotifierExtensions): NotifierDependencies {
  const logger = createLogger(config.logLevel, { component: "notifier" });
  if (!config.tables) throw new NotifierNotConfiguredError("table names");
  if (!config.notificationsTable) throw new NotifierNotConfiguredError("NOTIFICATIONS_TABLE");
  if (!config.householdTenantId) throw new NotifierNotConfiguredError("HOUSEHOLD_TENANT_ID");
  const client = getDocumentClient();
  const households = new DynamoDbHouseholdRepository(client, config.tables.households);
  const householdService = new HouseholdService(households, systemClock, config.timezone, async () => []);
  const memberService = new MemberService(households, systemClock);
  return {
    tenantId: config.householdTenantId,
    members: (tenantId) => memberService.membersOf(tenantId),
    timezoneOf: (tenantId) => householdService.timezoneOf(tenantId),
    jobs: extensions?.jobs ?? [],
    channels: extensions?.channels ?? [new LogChannel(logger)],
    log: new DynamoDbDeliveryLog(client, config.notificationsTable),
    logger,
    now: systemClock,
  };
}

let dependencies: NotifierDependencies | undefined;

export async function handler(): Promise<RunSummary> {
  dependencies ??= createNotifierDependencies();
  return runNotifier(dependencies);
}
