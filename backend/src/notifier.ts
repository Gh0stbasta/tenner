/**
 * Lambda entry point of the notifier (function tenner-notifier, NOTIFICATION-001). Invoked every 15 minutes by an
 * EventBridge schedule (notification jobs, Echo Show widget day start) and by "HouseholdChanged" events from the API
 * (widget refresh, ALEXA-007).
 */

import {
  AlexaChannel,
  createDataStoreClient,
  createLwaTokenClient,
  createProactiveEventsClient,
  createSkillMessagingClient,
  WidgetPushService,
} from "./alexa/index.js";
import { getDocumentClient } from "./clients/dynamodb.js";
import { getSsmClient } from "./clients/ssm.js";
import { loadConfig, type AppConfig } from "./config.js";
import type { DashboardRequest } from "./dto/index.js";
import { HOUSEHOLD_CHANGED } from "./events/household-events.js";
import {
  LogChannel,
  dailyDigestJob,
  overdueAlertJob,
  runNotifier,
  type NotificationChannel,
  type NotificationJob,
  type NotifierDependencies,
  type RunSummary,
} from "./notifications/index.js";
import { DynamoDbDeliveryLog, DynamoDbHouseholdRepository, DynamoDbTennerRepository } from "./repositories/index.js";
import { createSecretLoader } from "./secrets/index.js";
import { AlexaSpeakerService, DashboardService, HouseholdService, MemberService, NotificationPreferencesService } from "./services/index.js";
import { systemClock } from "./utils/clock.js";
import { createLogger, type Logger } from "./utils/logger.js";

export class NotifierNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`Notifier is not configured: ${missing} missing.`);
    this.name = "NotifierNotConfiguredError";
  }
}

/** Jobs and channels added by the channel tickets (ALEXA-008) or tests. */
export interface NotifierExtensions {
  readonly jobs: readonly NotificationJob[];
  readonly channels: readonly NotificationChannel[];
}

export interface NotifierRuntime {
  readonly notifier: NotifierDependencies;
  /** Echo Show widget pushes (ALEXA-007); undefined without Alexa API configuration. */
  readonly widget: WidgetPushService | undefined;
}

export function createNotifierRuntime(config: AppConfig = loadConfig(), extensions?: NotifierExtensions, fetchImpl: typeof fetch = globalThis.fetch): NotifierRuntime {
  const logger = createLogger(config.logLevel, { component: "notifier" });
  if (!config.tables) throw new NotifierNotConfiguredError("table names");
  if (!config.notificationsTable) throw new NotifierNotConfiguredError("NOTIFICATIONS_TABLE");
  if (!config.householdTenantId) throw new NotifierNotConfiguredError("HOUSEHOLD_TENANT_ID");
  const client = getDocumentClient();
  const households = new DynamoDbHouseholdRepository(client, config.tables.households);
  const householdService = new HouseholdService(households, systemClock, config.timezone, async () => []);
  const memberService = new MemberService(households, systemClock);
  const timezoneOf = (tenantId: string) => householdService.timezoneOf(tenantId);
  const membersOf = (tenantId: string) => memberService.membersOf(tenantId);
  const tenners = new DynamoDbTennerRepository(client, config.tables.tenners, config.tables.history);
  // Same read model as GET /dashboard: due, overdue, shared and paused rules are not duplicated.
  const dashboardService = new DashboardService(tenners, systemClock, timezoneOf, (tenantId) => householdService.vacationOf(tenantId), membersOf);
  const preferences = new NotificationPreferencesService(households, systemClock, timezoneOf);
  const log = new DynamoDbDeliveryLog(client, config.notificationsTable);
  const dashboard = (tenantId: string, request: DashboardRequest) => dashboardService.getDashboard(tenantId, request);
  const content = { preferencesOf: (tenantId: string, userId: string) => preferences.preferencesOf(tenantId, userId), dashboard, appUrl: config.appUrl };
  const jobs: NotificationJob[] = [
    dailyDigestJob(content),
    overdueAlertJob({
      ...content,
      frequencies: async (tenantId) => new Map((await tenners.list(tenantId)).map((tenner) => [tenner.tennerId, tenner.frequencyDays])),
      log,
    }),
  ];
  const notifier: NotifierDependencies = {
    tenantId: config.householdTenantId,
    members: membersOf,
    timezoneOf,
    jobs: [...jobs, ...(extensions?.jobs ?? [])],
    channels: [],
    log,
    logger,
    now: systemClock,
  };

  const alexaApi = config.alexaApi;
  let widget: WidgetPushService | undefined;
  const channels: NotificationChannel[] = [new LogChannel(logger)];
  if (alexaApi) {
    const secrets = createSecretLoader({ client: getSsmClient() });
    const lwa = createLwaTokenClient({
      credentials: async () => ({ clientId: await secrets.get(alexaApi.clientIdParameter), clientSecret: await secrets.get(alexaApi.clientSecretParameter) }),
      fetch: fetchImpl,
    });
    const alexaUsers = new AlexaSpeakerService(households, systemClock, config.timezone);
    widget = new WidgetPushService({
      alexaUsers: (tenantId) => alexaUsers.alexaUsersOf(tenantId),
      removeAlexaUser: (tenantId, alexaUserId) => alexaUsers.removeAlexaUser(tenantId, alexaUserId),
      dashboard,
      members: membersOf,
      timezoneOf,
      lwa,
      dataStore: createDataStoreClient(alexaApi.endpoint, fetchImpl),
      log,
      logger,
      now: systemClock,
    });
    // ALEXA-008: Alexa notifications (overdue) and reminders (daily digest).
    channels.push(
      new AlexaChannel({
        alexaUsers: (tenantId) => alexaUsers.alexaUsersOf(tenantId),
        removeAlexaUser: (tenantId, alexaUserId) => alexaUsers.removeAlexaUser(tenantId, alexaUserId),
        lwa,
        proactiveEvents: createProactiveEventsClient(alexaApi.endpoint, alexaApi.skillStage, fetchImpl),
        skillMessaging: createSkillMessagingClient(alexaApi.endpoint, fetchImpl),
        now: systemClock,
      }),
    );
  }
  return { notifier: { ...notifier, channels: extensions?.channels ?? channels }, widget };
}

/** EventBridge input: a scheduled event or a HouseholdChanged event from the API. */
export interface NotifierEvent {
  readonly "detail-type"?: string;
  readonly detail?: { readonly tenantId?: unknown };
}

export interface NotifierResult {
  readonly run?: RunSummary;
  readonly widget: "PUSHED_OR_SKIPPED" | "FAILED" | "DISABLED";
}

/** Route one invocation; widget failures are logged and never fail the scheduled notification run. */
export async function handleNotifierEvent(runtime: NotifierRuntime, event: NotifierEvent): Promise<NotifierResult> {
  const { notifier, widget } = runtime;
  if (event["detail-type"] === HOUSEHOLD_CHANGED) {
    const tenantId = typeof event.detail?.tenantId === "string" ? event.detail.tenantId : notifier.tenantId;
    return { widget: await safely(notifier.logger, widget, (service) => service.onChange(tenantId)) };
  }
  const run = await runNotifier(notifier);
  return { run, widget: await safely(notifier.logger, widget, (service) => service.onSchedule(notifier.tenantId)) };
}

async function safely(logger: Logger, widget: WidgetPushService | undefined, action: (service: WidgetPushService) => Promise<void>): Promise<NotifierResult["widget"]> {
  if (!widget) return "DISABLED";
  try {
    await action(widget);
    return "PUSHED_OR_SKIPPED";
  } catch (error) {
    logger.error("Widget update failed", { event: "WidgetUpdateFailed", error: error instanceof Error ? error.name : "UnknownError" });
    return "FAILED";
  }
}

let runtime: NotifierRuntime | undefined;

export async function handler(event: NotifierEvent = {}): Promise<NotifierResult> {
  runtime ??= createNotifierRuntime();
  return handleNotifierEvent(runtime, event);
}
