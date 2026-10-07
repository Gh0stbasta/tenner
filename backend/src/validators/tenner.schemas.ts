import { z } from "zod";
import { GRANULARITIES } from "../analytics/aggregations.js";
import { MAX_NEGLECTED_LIMIT } from "../analytics/neglect.js";
import { PERIOD_SHORTCUTS } from "../analytics/period.js";
import {
  TENNER_SORT_FIELDS,
  type AssignHouseholdMemberRequest,
  type LinkAlexaSpeakerRequest,
  type UpdateNotificationPreferencesRequest,
  type UpdateHouseholdRequest,
  type CompleteTennerRequest,
  type DashboardRequest,
  type HistoryRequest,
  type TennerHistoryRequest,
  type CreateTennerRequest,
  type ListTennersRequest,
  type RestoreTennerRequest,
  type SnoozeTennerRequest,
  type SkipTennerRequest,
  type PauseTennerRequest,
  type CreateMemberRequest,
  type DeactivateMemberRequest,
  type StartHandoverRequest,
  type AnalyticsPeriodRequest,
  type AnalyticsTrendsRequest,
  type AnalyticsNeglectedRequest,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
  type UpdateMemberRequest,
  type VacationRequest,
  type CatalogImportRequest,
  type PushSubscriptionRequest,
  type RemovePushSubscriptionRequest,
  type UndoCompletionRequest,
  type UpdateTennerRequest,
} from "../dto/index.js";
import {
  actualMinutesSchema,
  booleanFlagSchema,
  categorySchema,
  estimatedMinutesSchema,
  isoDateSchema,
  frequencyDaysSchema,
  frequencyIntervalSchema,
  frequencyUnitSchema,
  weekdaysSchema,
  displayNameSchema,
  categoryIconSchema,
  memberColorSchema,
  titleSchema,
  userIdSchema,
  utcTimestampSchema,
} from "./common.js";
import { ALEXA_PERSON_ID_PATTERN, ALEXA_USER_ID_PATTERN, DEFAULT_OVERDUE_ALERT_TIME, PUSH_SNOOZE_OPTIONS, USER_CHANNELS, WEEKDAYS as ALL_WEEKDAYS } from "../models/index.js";
import { isValidTimeZone } from "../utils/timezone.js";
import { approximateFrequencyDays, MAX_FREQUENCY_DAYS, type Frequency } from "../utils/schedule.js";
import { ASSIGNMENT_MODES, SHARED_ASSIGNEE, WEEK_STARTS, WEEKDAYS, type AssignmentMode, type UserId, type Weekday } from "../models/index.js";

const tennerFields = {
  title: titleSchema,
  category: categorySchema,
  estimatedMinutes: estimatedMinutesSchema,
  frequencyDays: frequencyDaysSchema.optional(),
  frequencyUnit: frequencyUnitSchema.optional(),
  frequencyInterval: frequencyIntervalSchema.optional(),
  weekdays: weekdaysSchema.nullable().optional(),
  assignedTo: userIdSchema,
  assignmentMode: z.enum(ASSIGNMENT_MODES).optional(),
  rotation: z.array(userIdSchema).max(20).nullable().optional(),
};

interface FrequencyInput {
  readonly frequencyDays?: number | undefined;
  readonly frequencyUnit?: Frequency["frequencyUnit"] | undefined;
  readonly frequencyInterval?: number | undefined;
  readonly weekdays?: readonly Weekday[] | null | undefined;
}

type NormalizedFrequency = Required<Frequency> & { readonly frequencyDays: number };

/**
 * Normalize the frequency fields (SCHEDULING-001): `frequencyDays` alone → DAY with interval = days (requests
 * from before SCHEDULING-001 stay valid); `frequencyUnit` (+ `frequencyInterval`, default 1) → derived
 * frequencyDays. Mixing both forms is rejected so a client can never send contradicting values.
 * `weekdays` (SCHEDULING-002) is only valid with frequencyUnit WEEK in the same request; every frequency change
 * without weekdays resets them to null.
 */
function normalizeFrequency(value: FrequencyInput, ctx: z.RefinementCtx): NormalizedFrequency | undefined {
  const { frequencyDays, frequencyUnit, frequencyInterval } = value;
  const weekdays = value.weekdays ? WEEKDAYS.filter((day) => value.weekdays?.includes(day)) : null;
  if ((weekdays !== null && frequencyUnit !== "WEEK") || (value.weekdays !== undefined && frequencyUnit === undefined)) {
    ctx.addIssue({ code: "custom", path: ["weekdays"], message: "weekdays require frequencyUnit WEEK in the same request." });
    return undefined;
  }
  if (frequencyDays !== undefined && (frequencyUnit !== undefined || frequencyInterval !== undefined)) {
    ctx.addIssue({ code: "custom", path: ["frequencyDays"], message: "Use either frequencyDays or frequencyUnit with frequencyInterval." });
    return undefined;
  }
  if (frequencyInterval !== undefined && frequencyUnit === undefined) {
    ctx.addIssue({ code: "custom", path: ["frequencyUnit"], message: "frequencyUnit is required with frequencyInterval." });
    return undefined;
  }
  if (frequencyDays !== undefined) return { frequencyDays, frequencyUnit: "DAY", frequencyInterval: frequencyDays, weekdays: null };
  if (frequencyUnit === undefined) return undefined;
  const interval = frequencyInterval ?? 1;
  if (approximateFrequencyDays(frequencyUnit, interval) > MAX_FREQUENCY_DAYS) {
    ctx.addIssue({ code: "custom", path: ["frequencyInterval"], message: `The frequency must not exceed ${MAX_FREQUENCY_DAYS} days.` });
    return undefined;
  }
  return { frequencyDays: approximateFrequencyDays(frequencyUnit, interval, weekdays), frequencyUnit, frequencyInterval: interval, weekdays };
}

interface AssignmentInput {
  readonly assignedTo?: UserId | undefined;
  readonly assignmentMode?: AssignmentMode | undefined;
  readonly rotation?: readonly UserId[] | null | undefined;
}

/**
 * Normalize the assignment fields (HOUSEHOLD-001): ROTATING needs `rotation` (≥ 2 distinct members, not HOUSEHOLD)
 * in the same request, and a given `assignedTo` must be part of it; FIXED stores rotation null. `rotation` without
 * ROTATING is rejected. Undefined result = no assignment-mode change.
 */
function normalizeAssignment(value: AssignmentInput, ctx: z.RefinementCtx): { assignmentMode: AssignmentMode; rotation: UserId[] | null } | undefined {
  const { assignmentMode, rotation, assignedTo } = value;
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (rotation != null && assignmentMode !== "ROTATING") {
    issue("rotation", "rotation requires assignmentMode ROTATING in the same request.");
    return undefined;
  }
  if (assignmentMode === undefined) return undefined;
  if (assignmentMode === "FIXED") return { assignmentMode, rotation: null };
  const members = rotation ?? [];
  if (members.length < 2 || new Set(members).size !== members.length || members.includes(SHARED_ASSIGNEE)) {
    issue("rotation", "A rotation needs at least two distinct household members.");
    return undefined;
  }
  if (assignedTo !== undefined && !members.includes(assignedTo)) {
    issue("assignedTo", "Must be part of the rotation.");
    return undefined;
  }
  return { assignmentMode, rotation: [...members] };
}

/** The request without the raw frequency fields (they are replaced by the normalized ones). */
function omitFrequency<T extends FrequencyInput>(value: T): Omit<T, keyof FrequencyInput> {
  const rest: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete rest.frequencyDays;
  delete rest.frequencyUnit;
  delete rest.frequencyInterval;
  delete rest.weekdays;
  delete rest.assignmentMode;
  delete rest.rotation;
  return rest as Omit<T, keyof FrequencyInput>;
}

/** Create: a frequency is required, in either form. */
export const createTennerSchema = z.strictObject(tennerFields).transform((value, ctx): CreateTennerRequest => {
  const rest = omitFrequency(value);
  const frequency = normalizeFrequency(value, ctx);
  if (frequency === undefined) {
    if (ctx.issues.length === 0) ctx.addIssue({ code: "custom", path: ["frequencyDays"], message: "frequencyDays or frequencyUnit is required." });
    return z.NEVER;
  }
  const assignment = normalizeAssignment(value, ctx) ?? { assignmentMode: "FIXED" as const, rotation: null };
  if (ctx.issues.length > 0) return z.NEVER;
  return { ...rest, ...frequency, ...assignment };
}) satisfies z.ZodType<CreateTennerRequest>;

/** Partial update; protected fields (tenantId, tennerId, createdAt, lastCompleted, nextDue) are rejected as unknown keys. */
export const updateTennerSchema = z
  .strictObject({ ...tennerFields, active: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided." })
  .transform((value, ctx): UpdateTennerRequest => {
    const rest = omitFrequency(value);
    const frequency = normalizeFrequency(value, ctx);
    const assignment = normalizeAssignment(value, ctx);
    return { ...rest, ...(frequency ?? {}), ...(assignment ?? {}) };
  }) satisfies z.ZodType<UpdateTennerRequest>;

export const completeTennerSchema = z.strictObject({
  completedBy: userIdSchema.optional(),
  actualMinutes: actualMinutesSchema.optional(),
  completedAt: utcTimestampSchema.optional(),
}) satisfies z.ZodType<CompleteTennerRequest>;

/** Query string of GET /tenners. Unknown parameters are rejected. */
export const listTennersQuerySchema = z.strictObject({
  assignedTo: userIdSchema.optional(),
  category: categorySchema.optional(),
  active: booleanFlagSchema.optional(),
  deleted: booleanFlagSchema.optional(),
  due: booleanFlagSchema.optional(),
  overdue: booleanFlagSchema.optional(),
  sort: z.enum(TENNER_SORT_FIELDS).optional(),
  order: z.enum(["asc", "desc"]).optional(),
}) satisfies z.ZodType<ListTennersRequest, Record<string, string | undefined>>;

/** Path parameter {tennerId}: UUIDs today; alphanumerics and dashes, 1-64 characters. */
export const tennerIdSchema = z.string().regex(/^[A-Za-z0-9-]{1,64}$/, "Invalid Tenner ID.");

/** Optional Idempotency-Key header: 1-128 printable characters without spaces. */
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/, "Invalid Idempotency-Key header.");

/** Undo request (TICKET-014): reason is trimmed; whitespace-only and > 250 characters are rejected. */
export const undoCompletionSchema = z.strictObject({
  revertedBy: userIdSchema.optional(),
  reason: z.string().trim().min(1, "Reason must not be blank.").max(250).optional(),
}) satisfies z.ZodType<UndoCompletionRequest>;

export const restoreTennerSchema = z.strictObject({ restoredBy: userIdSchema.optional() }) satisfies z.ZodType<RestoreTennerRequest>;

/** Query string of GET /dashboard (TICKET-016). Dates must be real calendar dates (2026-02-30 is rejected). */
export const dashboardQuerySchema = z.strictObject({
  assignedTo: userIdSchema.optional(),
  category: categorySchema.optional(),
  date: isoDateSchema.optional(),
}) satisfies z.ZodType<DashboardRequest, Record<string, string | undefined>>;

/** Query string of GET /tenners/{tennerId} (TICKET-019). */
export const getTennerQuerySchema = z.strictObject({
  includeDeleted: booleanFlagSchema.optional(),
});

/** Page size as query-string number: integer 1 - 100. */
const limitSchema = z
  .string()
  .regex(/^\d{1,3}$/, "Must be an integer.")
  .transform(Number)
  .pipe(z.number().int().min(1).max(100));

/** Opaque pagination cursor (base64url). */
const cursorSchema = z.string().regex(/^[A-Za-z0-9_-]{1,2048}$/, "Invalid cursor.");

/** Query string of GET /history (TICKET-020). */
export const historyQuerySchema = z
  .strictObject({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    completedBy: userIdSchema.optional(),
    limit: limitSchema.optional(),
    cursor: cursorSchema.optional(),
    includeUndone: booleanFlagSchema.optional(),
  })
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, { message: "from must not be after to.", path: ["from"] }) satisfies z.ZodType<
  HistoryRequest,
  Record<string, string | undefined>
>;

/** Query string of GET /tenners/{tennerId}/history (TICKET-020). */
export const tennerHistoryQuerySchema = z.strictObject({
  limit: limitSchema.optional(),
  cursor: cursorSchema.optional(),
  includeUndone: booleanFlagSchema.optional(),
}) satisfies z.ZodType<TennerHistoryRequest, Record<string, string | undefined>>;

/** POST /onboarding/assignment (HOTFIX-001). */
export const assignHouseholdMemberSchema = z.strictObject({ userId: userIdSchema }) satisfies z.ZodType<AssignHouseholdMemberRequest>;

/** ALEXA-002: Amazon person ID in the path of /household/alexa-speakers/{personId}. */
export const alexaPersonIdSchema = z.string().regex(ALEXA_PERSON_ID_PATTERN, "Invalid Alexa person ID.");

/** ALEXA-007: Amazon account ID (context.System.user.userId). */
export const alexaUserIdSchema = z.string().regex(ALEXA_USER_ID_PATTERN, "Invalid Alexa user ID.");

/** PUT /household/alexa-speakers/{personId} (ALEXA-002). */
export const linkAlexaSpeakerSchema = z.strictObject({ userId: userIdSchema }) satisfies z.ZodType<LinkAlexaSpeakerRequest>;

/** NOTIFICATION-002: send times in 15-minute steps (the notifier's schedule). */
export const quarterHourSchema = z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, "Must be HH:mm in 15-minute steps.");
const userChannelsSchema = z
  .array(z.enum(USER_CHANNELS))
  .max(USER_CHANNELS.length)
  .refine((channels) => new Set(channels).size === channels.length, "Channels must be distinct.");

/** PUT /users/{userId}/notification-preferences (NOTIFICATION-002): the full preferences, unknown fields rejected. */
export const notificationPreferencesSchema = z.strictObject({
  timezone: z.string().refine(isValidTimeZone, "Must be an IANA timezone.").nullable(),
  dailyDigest: z.strictObject({ enabled: z.boolean(), time: quarterHourSchema, channels: userChannelsSchema }),
  // NOTIFICATION-010: `time` may be omitted by older clients (default 18:00).
  overdueAlerts: z.strictObject({
    enabled: z.boolean(),
    minDaysOverdue: z.number().int().min(0).max(30),
    time: quarterHourSchema.default(DEFAULT_OVERDUE_ALERT_TIME),
    channels: userChannelsSchema,
  }),
  weeklySummary: z.strictObject({ enabled: z.boolean(), dayOfWeek: z.enum(ALL_WEEKDAYS), time: quarterHourSchema, channels: userChannelsSchema }),
  quietHours: z.strictObject({ start: quarterHourSchema, end: quarterHourSchema }).nullable(),
  // NOTIFICATION-011; older clients omit it.
  pushSnooze: z.enum(PUSH_SNOOZE_OPTIONS).default("1H"),
}) satisfies z.ZodType<UpdateNotificationPreferencesRequest>;

/** PUT /household (SCHEDULING-008): an IANA timezone the runtime knows; unknown fields rejected. */
export const updateHouseholdSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(60).optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((value) => /^[A-Za-z0-9_+\-/]+$/.test(value) && isValidTimeZone(value), { message: "Unknown timezone." })
      .optional(),
    weekStartsOn: z.enum(WEEK_STARTS).optional(),
    workdays: weekdaysSchema.transform((days) => WEEKDAYS.filter((day) => days.includes(day))).optional(),
    defaults: z
      .strictObject({ category: categorySchema, estimatedMinutes: estimatedMinutesSchema, frequencyDays: frequencyDaysSchema })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided." }) satisfies z.ZodType<UpdateHouseholdRequest>;

/** Snooze (SCHEDULING-003): exactly one of `until` (real calendar date) or `days` (1–3650). */
export const snoozeTennerSchema = z
  .strictObject({
    until: isoDateSchema.optional(),
    days: z.number().int().min(1).max(3650).optional(),
  })
  .refine((value) => (value.until === undefined) !== (value.days === undefined), {
    message: "Provide either until or days.",
  }) satisfies z.ZodType<SnoozeTennerRequest>;

/** Skip (SCHEDULING-004): optional reason, trimmed, 1–200 characters. */
export const skipTennerSchema = z.strictObject({
  reason: z.string().trim().min(1, "Reason must not be blank.").max(200).optional(),
}) satisfies z.ZodType<SkipTennerRequest>;

/** Pause (SCHEDULING-005): optional last paused day; "after today" is checked by the service (household timezone). */
export const pauseTennerSchema = z.strictObject({ until: isoDateSchema.optional() }) satisfies z.ZodType<PauseTennerRequest>;

/** Vacation (SCHEDULING-005): from <= until; categories optional (default all), distinct. */
export const vacationSchema = z
  .strictObject({
    from: isoDateSchema,
    until: isoDateSchema,
    categories: z
      .array(categorySchema)
      .min(1)
      .refine((values) => new Set(values).size === values.length, "Categories must be distinct.")
      .optional(),
  })
  .refine((value) => value.from <= value.until, { path: ["until"], message: "Must not be before from." }) satisfies z.ZodType<VacationRequest>;

/** POST /users (HOUSEHOLD-ADMIN-001). */
export const createMemberSchema = z.strictObject({
  userId: userIdSchema.optional(),
  displayName: displayNameSchema,
  color: memberColorSchema,
  canSignIn: z.boolean().optional(),
}) satisfies z.ZodType<CreateMemberRequest>;

/** PUT /users/{userId}: rename or recolor; userId is immutable. */
export const updateMemberSchema = z
  .strictObject({ displayName: displayNameSchema.optional(), color: memberColorSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided." }) satisfies z.ZodType<UpdateMemberRequest>;

/** POST /categories (HOUSEHOLD-ADMIN-002). */
export const createCategorySchema = z.strictObject({
  categoryId: categorySchema.optional(),
  name: displayNameSchema,
  icon: categoryIconSchema,
  color: memberColorSchema,
}) satisfies z.ZodType<CreateCategoryRequest>;

/** PUT /categories/{categoryId}: rename, icon, color, position, archive; categoryId is immutable. */
export const updateCategorySchema = z
  .strictObject({
    name: displayNameSchema.optional(),
    icon: categoryIconSchema.optional(),
    color: memberColorSchema.optional(),
    sortOrder: z.number().int().min(0).max(99).optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided." }) satisfies z.ZodType<UpdateCategoryRequest>;

/** POST /users/{userId}/deactivate (HOUSEHOLD-ADMIN-004). */
export const deactivateMemberSchema = z.strictObject({ reassignTo: userIdSchema.optional() }) satisfies z.ZodType<DeactivateMemberRequest>;

/** POST /users/{userId}/handover (HOUSEHOLD-004). */
export const startHandoverSchema = z.strictObject({
  to: userIdSchema,
  until: isoDateSchema,
  categories: z
    .array(categorySchema)
    .min(1)
    .refine((values) => new Set(values).size === values.length, "Categories must be distinct.")
    .optional(),
}) satisfies z.ZodType<StartHandoverRequest>;

/** Period query of the analytics endpoints (ANALYTICS-001); range rules are checked by resolvePeriod. */
export const analyticsPeriodShape = {
  period: z.enum(PERIOD_SHORTCUTS).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
};

/** GET /analytics/summary. */
export const analyticsPeriodSchema = z.strictObject(analyticsPeriodShape) satisfies z.ZodType<AnalyticsPeriodRequest, Record<string, string | undefined>>;

/** GET /analytics/trends (ANALYTICS-002). */
export const analyticsTrendsSchema = z.strictObject({
  ...analyticsPeriodShape,
  granularity: z.enum(GRANULARITIES).optional(),
  assignedTo: userIdSchema.optional(),
  category: categorySchema.optional(),
}) satisfies z.ZodType<AnalyticsTrendsRequest, Record<string, string | undefined>>;

/** GET /analytics/neglected (ANALYTICS-006). */
export const analyticsNeglectedSchema = z.strictObject({
  ...analyticsPeriodShape,
  limit: z
    .string()
    .regex(/^\d{1,2}$/, "Must be an integer.")
    .transform(Number)
    .pipe(z.number().int().min(1).max(MAX_NEGLECTED_LIMIT))
    .optional(),
}) satisfies z.ZodType<AnalyticsNeglectedRequest, Record<string, string | undefined>>;

/** POST /household/catalog (DATA-008): an empty body imports; `{ "dryRun": true }` only reports. */
export const catalogImportSchema = z.strictObject({ dryRun: z.boolean().optional() }) satisfies z.ZodType<CatalogImportRequest>;

/** Push service URLs are HTTPS and short; the endpoint is a capability URL and never logged (NOTIFICATION-009). */
const pushEndpointSchema = z.url({ protocol: /^https$/ }).max(1000);
const base64UrlSchema = (min: number, max: number) => z.string().regex(/^[A-Za-z0-9_-]+$/, "Must be base64url.").min(min).max(max);

/** PushSubscription.toJSON() of the browser. */
export const pushSubscriptionSchema = z.strictObject({
  endpoint: pushEndpointSchema,
  expirationTime: z.number().nullable().optional(),
  // p256dh: 65-byte uncompressed P-256 key (87 base64url chars); auth: 16 bytes (22 chars).
  keys: z.strictObject({ p256dh: base64UrlSchema(87, 88), auth: base64UrlSchema(22, 24) }),
}) satisfies z.ZodType<PushSubscriptionRequest>;

export const removePushSubscriptionSchema = z.strictObject({ endpoint: pushEndpointSchema }) satisfies z.ZodType<RemovePushSubscriptionRequest>;

/** POST /push-actions (NOTIFICATION-011): the signed action token (payload.signature, base64url). */
export const pushActionSchema = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/).max(2000) });
