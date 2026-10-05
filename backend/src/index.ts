/**
 * Lambda entry point for the Tenner API (function tenner-api).
 * Routes API Gateway HTTP API requests by route key to handlers and maps errors to the
 * standard error response.
 */

import { AnalyticsService } from "./analytics/index.js";
import { analyticsHandler, type AnalyticsQuery } from "./handlers/analytics.js";
import { householdGroupName, identityFromEvent, principalFromEvent, type Identity, type Principal } from "./auth/index.js";
import { getCognitoClient } from "./clients/cognito.js";
import { getDocumentClient, probeTables } from "./clients/dynamodb.js";
import { loadConfig, type AppConfig } from "./config.js";
import { ApplicationError, NotFoundError } from "./exceptions/index.js";
import { completeTennerHandler, type CompleteTenner } from "./handlers/complete-tenner.js";
import { createTennerHandler, type CreateTenner } from "./handlers/create-tenner.js";
import { dashboardHandler, type GetDashboard } from "./handlers/dashboard.js";
import { deleteTennerHandler, type DeleteTenner } from "./handlers/delete-tenner.js";
import { getTennerHandler, type GetTenner } from "./handlers/get-tenner.js";
import { health, type DatabaseProbe } from "./handlers/health.js";
import {
  endVacationHandler,
  getHouseholdHandler,
  setVacationHandler,
  updateHouseholdHandler,
  type EndVacation,
  type GetHousehold,
  type SetVacation,
  type UpdateHousehold,
} from "./handlers/household.js";
import { pauseTennerHandler, resumeTennerHandler, type PauseTenner, type ResumeTenner } from "./handlers/pause-tenner.js";
import { createCategoryHandler, listCategoriesHandler, updateCategoryHandler, type CreateCategory, type ListCategories, type UpdateCategory } from "./handlers/categories.js";
import {
  createMemberHandler,
  deactivateMemberHandler,
  endHandoverHandler,
  listMembersHandler,
  reactivateMemberHandler,
  startHandoverHandler,
  updateMemberHandler,
  type CreateMember,
  type DeactivateMember,
  type EndHandover,
  type ListMembers,
  type ReactivateMember,
  type StartHandover,
  type UpdateMember,
} from "./handlers/members.js";
import { historyHandler, tennerHistoryHandler, type GetHistory, type GetTennerHistory } from "./handlers/history.js";
import { listTennersHandler, type ListTenners } from "./handlers/list-tenners.js";
import { assignHouseholdMemberHandler, onboardingHandler, type AssignHouseholdMember, type GetOnboarding } from "./handlers/onboarding.js";
import { restoreTennerHandler, type RestoreTenner } from "./handlers/restore-tenner.js";
import { skipTennerHandler, type SkipTenner } from "./handlers/skip-tenner.js";
import { snoozeTennerHandler, type SnoozeTenner } from "./handlers/snooze-tenner.js";
import { undoCompletionHandler, type UndoCompletion } from "./handlers/undo-completion.js";
import { updateTennerHandler, type UpdateTenner } from "./handlers/update-tenner.js";
import {
  CognitoHouseholdMembershipRepository,
  DynamoDbCompletionRepository,
  DynamoDbHouseholdRepository,
  DynamoDbTennerRepository,
} from "./repositories/index.js";
import {
  CompleteTennerService,
  CreateTennerService,
  DashboardService,
  DeleteTennerService,
  GetTennerService,
  HistoryService,
  HouseholdAssignmentService,
  HouseholdService,
  HandoverService,
  toHouseholdResponse,
  ListTennersService,
  RestoreTennerService,
  CategoryService,
  MemberDeactivationService,
  MemberService,
  PauseTennerService,
  SkipTennerService,
  VacationService,
  SnoozeTennerService,
  UndoCompletionService,
  UpdateTennerService,
} from "./services/index.js";
import { systemClock, uuidGenerator } from "./utils/clock.js";
import type { ApiEvent, ApiResult } from "./types/api.js";
import { errorResponse } from "./utils/http.js";
import { SEED_CATEGORIES, SEED_MEMBERS, type Handover, type HouseholdCategory, type HouseholdMember, type Vacation } from "./models/index.js";
import { createLogger, errorFields, type Logger } from "./utils/logger.js";
import type { AnalyticsPeriodRequest, AnalyticsSummaryResponse, AnalyticsTrendsRequest, AnalyticsTrendsResponse, AnalyticsUsersResponse, AnalyticsCategoriesResponse, AnalyticsNeglectedRequest, AnalyticsNeglectedResponse, AnalyticsBalanceResponse, AnalyticsHabitResponse, AnalyticsHabitsResponse, HouseholdResponse } from "./dto/index.js";
import { analyticsNeglectedSchema, analyticsPeriodSchema, analyticsTrendsSchema, tennerIdSchema, validate } from "./validators/index.js";

/** Dependencies shared by all handlers; replaced in tests. */
export interface Dependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly probeDatabase: DatabaseProbe;
  readonly createTenner: CreateTenner;
  readonly listTenners: ListTenners;
  readonly updateTenner: UpdateTenner;
  readonly deleteTenner: DeleteTenner;
  readonly completeTenner: CompleteTenner;
  readonly undoCompletion: UndoCompletion;
  readonly restoreTenner: RestoreTenner;
  readonly snoozeTenner: SnoozeTenner;
  readonly skipTenner: SkipTenner;
  readonly pauseTenner: PauseTenner;
  readonly resumeTenner: ResumeTenner;
  readonly setVacation: SetVacation;
  readonly endVacation: EndVacation;
  readonly listMembers: ListMembers;
  readonly createMember: CreateMember;
  readonly updateMember: UpdateMember;
  readonly deactivateMember: DeactivateMember;
  readonly reactivateMember: ReactivateMember;
  readonly startHandover: StartHandover;
  readonly endHandover: EndHandover;
  readonly listCategories: ListCategories;
  readonly createCategory: CreateCategory;
  readonly updateCategory: UpdateCategory;
  readonly getDashboard: GetDashboard;
  readonly getTenner: GetTenner;
  readonly getHistory: GetHistory;
  readonly getTennerHistory: GetTennerHistory;
  readonly getOnboarding: GetOnboarding;
  readonly getHousehold: GetHousehold;
  readonly updateHousehold: UpdateHousehold;
  readonly assignHouseholdMember: AssignHouseholdMember;
  readonly analyticsSummary: AnalyticsQuery<AnalyticsPeriodRequest, AnalyticsSummaryResponse>;
  readonly analyticsTrends: AnalyticsQuery<AnalyticsTrendsRequest, AnalyticsTrendsResponse>;
  readonly analyticsUsers: AnalyticsQuery<AnalyticsPeriodRequest, AnalyticsUsersResponse>;
  readonly analyticsCategories: AnalyticsQuery<AnalyticsPeriodRequest, AnalyticsCategoriesResponse>;
  readonly analyticsNeglected: AnalyticsQuery<AnalyticsNeglectedRequest, AnalyticsNeglectedResponse>;
  readonly analyticsBalance: AnalyticsQuery<AnalyticsPeriodRequest, AnalyticsBalanceResponse>;
  readonly analyticsHabits: AnalyticsQuery<AnalyticsPeriodRequest, AnalyticsHabitsResponse>;
  readonly analyticsHabit: (tenantId: string, tennerId: string, request: AnalyticsPeriodRequest) => Promise<AnalyticsHabitResponse>;
}

/** Per-request context passed to route handlers. */
export interface RequestContext {
  readonly event: ApiEvent;
  readonly deps: Dependencies;
  /** Logger bound to the request's correlationId (and, on protected routes, the acting user). */
  readonly logger: Logger;
}

/** Context of a protected route: additionally carries the identity from the verified JWT claims (SECURITY-004). */
export interface AuthenticatedContext extends RequestContext {
  readonly identity: Identity;
}

/** Context of an onboarding route: signed in, but not necessarily in a household yet (HOTFIX-001). */
export interface PrincipalContext extends RequestContext {
  readonly principal: Principal;
}

type RouteHandler = (ctx: AuthenticatedContext) => Promise<ApiResult>;
type PublicRouteHandler = (ctx: RequestContext) => Promise<ApiResult>;
type OnboardingRouteHandler = (ctx: PrincipalContext) => Promise<ApiResult>;

/** Routes without authentication; must match api_public_routes in terraform/locals.tf. */
const PUBLIC_ROUTES: Readonly<Record<string, PublicRouteHandler>> = {
  "GET /health": ({ deps, logger }) => health(deps.config, deps.probeDatabase, logger),
};

/** Signed-in users without a household may call these to pick their household member (HOTFIX-001). */
const ONBOARDING_ROUTES: Readonly<Record<string, OnboardingRouteHandler>> = {
  "GET /onboarding": ({ deps, principal }) => onboardingHandler(principal, deps.getOnboarding),
  "POST /onboarding/assignment": ({ event, deps, logger, principal }) => assignHouseholdMemberHandler(event, principal, deps.assignHouseholdMember, logger),
};

/** Protected routes. The tenant comes only from the identity; there is no default tenant. */
const ROUTES: Readonly<Record<string, RouteHandler>> = {
  "POST /tenners": ({ event, deps, logger, identity }) => createTennerHandler(event, identity, deps.createTenner, logger),
  "GET /tenners": ({ event, deps, logger, identity }) => listTennersHandler(event, identity.tenantId, deps.listTenners, logger),
  "GET /tenners/{tennerId}": ({ event, deps, logger, identity }) => getTennerHandler(event, identity.tenantId, deps.getTenner, logger),
  "GET /history": ({ event, deps, logger, identity }) => historyHandler(event, identity.tenantId, deps.getHistory, logger),
  "GET /tenners/{tennerId}/history": ({ event, deps, logger, identity }) => tennerHistoryHandler(event, identity.tenantId, deps.getTennerHistory, logger),
  "PUT /tenners/{tennerId}": ({ event, deps, logger, identity }) => updateTennerHandler(event, identity, deps.updateTenner, logger),
  "DELETE /tenners/{tennerId}": ({ event, deps, logger, identity }) => deleteTennerHandler(event, identity, deps.deleteTenner, logger),
  "POST /tenners/{tennerId}/complete": ({ event, deps, logger, identity }) => completeTennerHandler(event, identity, deps.completeTenner, logger),
  "POST /tenners/{tennerId}/undo-completion": ({ event, deps, logger, identity }) => undoCompletionHandler(event, identity, deps.undoCompletion, logger),
  "POST /tenners/{tennerId}/restore": ({ event, deps, logger, identity }) => restoreTennerHandler(event, identity, deps.restoreTenner, logger),
  "POST /tenners/{tennerId}/snooze": ({ event, deps, logger, identity }) => snoozeTennerHandler(event, identity, deps.snoozeTenner, logger),
  "POST /tenners/{tennerId}/skip": ({ event, deps, logger, identity }) => skipTennerHandler(event, identity, deps.skipTenner, logger),
  "POST /tenners/{tennerId}/pause": ({ event, deps, logger, identity }) => pauseTennerHandler(event, identity, deps.pauseTenner, logger),
  "POST /tenners/{tennerId}/resume": ({ event, deps, logger, identity }) => resumeTennerHandler(event, identity, deps.resumeTenner, logger),
  "PUT /household/vacation": ({ event, deps, logger, identity }) => setVacationHandler(event, identity, deps.setVacation, logger),
  "DELETE /household/vacation": ({ deps, logger, identity }) => endVacationHandler(identity, deps.endVacation, logger),
  "GET /users": ({ deps, identity }) => listMembersHandler(identity.tenantId, deps.listMembers),
  "POST /users": ({ event, deps, logger, identity }) => createMemberHandler(event, identity, deps.createMember, logger),
  "PUT /users/{userId}": ({ event, deps, logger, identity }) => updateMemberHandler(event, identity, deps.updateMember, logger),
  "POST /users/{userId}/deactivate": ({ event, deps, logger, identity }) => deactivateMemberHandler(event, identity, deps.deactivateMember, logger),
  "POST /users/{userId}/reactivate": ({ event, deps, logger, identity }) => reactivateMemberHandler(event, identity, deps.reactivateMember, logger),
  "POST /users/{userId}/handover": ({ event, deps, logger, identity }) => startHandoverHandler(event, identity, deps.startHandover, logger),
  "DELETE /users/{userId}/handover": ({ event, deps, logger, identity }) => endHandoverHandler(event, identity, deps.endHandover, logger),
  "GET /categories": ({ deps, identity }) => listCategoriesHandler(identity.tenantId, deps.listCategories),
  "POST /categories": ({ event, deps, logger, identity }) => createCategoryHandler(event, identity, deps.createCategory, logger),
  "PUT /categories/{categoryId}": ({ event, deps, logger, identity }) => updateCategoryHandler(event, identity, deps.updateCategory, logger),
  "GET /dashboard": ({ event, deps, logger, identity }) => dashboardHandler(event, identity.tenantId, deps.getDashboard, logger),
  "GET /household": ({ deps, identity }) => getHouseholdHandler(identity.tenantId, deps.getHousehold),
  "PUT /household": ({ event, deps, logger, identity }) => updateHouseholdHandler(event, identity, deps.updateHousehold, logger),
  "GET /analytics/summary": ({ event, deps, logger, identity }) => analyticsHandler("summary", analyticsPeriodSchema, event, identity.tenantId, deps.analyticsSummary, logger),
  "GET /analytics/trends": ({ event, deps, logger, identity }) => analyticsHandler("trends", analyticsTrendsSchema, event, identity.tenantId, deps.analyticsTrends, logger),
  "GET /analytics/users": ({ event, deps, logger, identity }) => analyticsHandler("users", analyticsPeriodSchema, event, identity.tenantId, deps.analyticsUsers, logger),
  "GET /analytics/categories": ({ event, deps, logger, identity }) => analyticsHandler("categories", analyticsPeriodSchema, event, identity.tenantId, deps.analyticsCategories, logger),
  "GET /analytics/neglected": ({ event, deps, logger, identity }) => analyticsHandler("neglected", analyticsNeglectedSchema, event, identity.tenantId, deps.analyticsNeglected, logger),
  "GET /analytics/balance": ({ event, deps, logger, identity }) => analyticsHandler("balance", analyticsPeriodSchema, event, identity.tenantId, deps.analyticsBalance, logger),
  "GET /analytics/habits": ({ event, deps, logger, identity }) => analyticsHandler("habits", analyticsPeriodSchema, event, identity.tenantId, deps.analyticsHabits, logger),
  "GET /analytics/habits/{tennerId}": ({ event, deps, logger, identity }) => {
    const tennerId = validate(tennerIdSchema, event.pathParameters?.tennerId);
    return analyticsHandler("habit", analyticsPeriodSchema, event, identity.tenantId, (tenantId, request) => deps.analyticsHabit(tenantId, tennerId, request), logger);
  },
};

const CORRELATION_HEADER = "x-correlation-id";

/** Build production dependencies once per container and log the startup configuration. */
export function createDependencies(config: AppConfig = loadConfig()): Dependencies {
  const logger = createLogger(config.logLevel);
  logger.info("Tenner API starting", {
    environment: config.environment,
    application: config.applicationName,
    timezone: config.timezone,
    tables: config.tables ?? "not configured",
    onboarding: config.onboarding ?? "not configured",
  });
  const tables = config.tables;
  const notConfigured = async (): Promise<never> => {
    throw new ApplicationError("SERVICE_UNAVAILABLE", 503, "Service is not configured.");
  };
  const tennerRepository = tables ? new DynamoDbTennerRepository(getDocumentClient(), tables.tenners, tables.history) : undefined;
  const completionRepository = tables ? new DynamoDbCompletionRepository(getDocumentClient(), tables.history) : undefined;
  const householdRepository = tables ? new DynamoDbHouseholdRepository(getDocumentClient(), tables.households) : undefined;
  const householdService = householdRepository ? new HouseholdService(householdRepository, systemClock, config.timezone, (tenantId) => categoriesOf(tenantId)) : undefined;
  // SCHEDULING-008: the one place that resolves a household's timezone for all date calculations.
  const timezoneOf = (tenantId: string): Promise<string> => householdService?.timezoneOf(tenantId) ?? Promise.resolve(config.timezone);
  const vacationOf = (tenantId: string): Promise<Vacation | null> => householdService?.vacationOf(tenantId) ?? Promise.resolve(null);
  // HOUSEHOLD-ADMIN-001: managed members; without the households table only the seed members exist.
  const memberService = householdRepository ? new MemberService(householdRepository, systemClock) : undefined;
  const membersOf = (tenantId: string): Promise<readonly HouseholdMember[]> => memberService?.membersOf(tenantId) ?? Promise.resolve(SEED_MEMBERS);
  // HOUSEHOLD-ADMIN-002: managed categories; without the households table only the seed categories exist.
  const categoryService = householdRepository ? new CategoryService(householdRepository, systemClock) : undefined;
  const categoriesOf = (tenantId: string): Promise<readonly HouseholdCategory[]> => categoryService?.categoriesOf(tenantId) ?? Promise.resolve(SEED_CATEGORIES);
  // HOUSEHOLD-004: no scheduler — expired handovers are given back before the reads that show assignments.
  const handoverService = householdRepository && tennerRepository ? new HandoverService(householdRepository, tennerRepository, systemClock, timezoneOf, logger) : undefined;
  const handoversOf = (tenantId: string): Promise<readonly Handover[]> => handoverService?.handoversOf(tenantId) ?? Promise.resolve([]);
  const expireHandovers = (tenantId: string): Promise<void> => handoverService?.expireDue(tenantId) ?? Promise.resolve();
  const createTennerService = tennerRepository ? new CreateTennerService(tennerRepository, systemClock, uuidGenerator, timezoneOf, membersOf, categoriesOf) : undefined;
  const listTennersService = tennerRepository ? new ListTennersService(tennerRepository, systemClock, timezoneOf) : undefined;
  const getTennerService = tennerRepository ? new GetTennerService(tennerRepository) : undefined;
  const historyService = tennerRepository && completionRepository ? new HistoryService(completionRepository, tennerRepository) : undefined;
  const updateTennerService = tennerRepository ? new UpdateTennerService(tennerRepository, systemClock, membersOf, categoriesOf) : undefined;
  const deleteTennerService = tennerRepository ? new DeleteTennerService(tennerRepository, systemClock) : undefined;
  const restoreTennerService = tennerRepository ? new RestoreTennerService(tennerRepository, systemClock) : undefined;
  const dashboardService = tennerRepository ? new DashboardService(tennerRepository, systemClock, timezoneOf, vacationOf, membersOf) : undefined;
  const completeTennerService =
    tennerRepository && completionRepository ? new CompleteTennerService(tennerRepository, completionRepository, systemClock, uuidGenerator, timezoneOf, vacationOf, membersOf, handoversOf) : undefined;
  const undoCompletionService = tennerRepository && completionRepository ? new UndoCompletionService(tennerRepository, completionRepository, systemClock, timezoneOf) : undefined;
  const snoozeTennerService = tennerRepository ? new SnoozeTennerService(tennerRepository, systemClock, uuidGenerator, timezoneOf) : undefined;
  const skipTennerService = tennerRepository ? new SkipTennerService(tennerRepository, systemClock, uuidGenerator, timezoneOf, vacationOf) : undefined;
  const pauseTennerService = tennerRepository ? new PauseTennerService(tennerRepository, systemClock, timezoneOf) : undefined;
  const vacationService = tennerRepository && householdRepository ? new VacationService(householdRepository, tennerRepository, systemClock, timezoneOf, logger) : undefined;
  // ANALYTICS-001: effective settings (timezone, week start, vacation); defaults without the households table.
  const settingsOf = (tenantId: string): Promise<HouseholdResponse> =>
    householdService?.settingsOf(tenantId) ?? Promise.resolve(toHouseholdResponse(undefined, config.timezone));
  const analyticsService = tennerRepository && completionRepository ? new AnalyticsService(tennerRepository, completionRepository, settingsOf, systemClock, membersOf, categoriesOf) : undefined;
  const onboarding = config.onboarding;
  const membershipRepository = onboarding ? new CognitoHouseholdMembershipRepository(getCognitoClient(), onboarding.userPoolId) : undefined;
  const householdAssignmentService = onboarding && membershipRepository ? new HouseholdAssignmentService(membershipRepository, onboarding.tenantId, membersOf) : undefined;
  // HOUSEHOLD-ADMIN-004: without Cognito configuration there are no groups to revoke.
  const revokeAccess = (tenantId: string, userId: string): Promise<number> =>
    membershipRepository?.removeAllMembers(householdGroupName(tenantId, userId)) ?? Promise.resolve(0);
  const memberDeactivationService =
    householdRepository && tennerRepository ? new MemberDeactivationService(householdRepository, tennerRepository, revokeAccess, systemClock) : undefined;

  return {
    config,
    logger,
    probeDatabase: (t) => probeTables(getDocumentClient(), t),
    createTenner: createTennerService ? (identity, request) => createTennerService.createTenner(identity, request) : notConfigured,
    listTenners: listTennersService ? async (tenantId, request) => (await expireHandovers(tenantId), listTennersService.listTenners(tenantId, request)) : notConfigured,
    updateTenner: updateTennerService ? (identity, id, request) => updateTennerService.updateTenner(identity, id, request) : notConfigured,
    deleteTenner: deleteTennerService ? (identity, id) => deleteTennerService.deleteTenner(identity, id) : notConfigured,
    restoreTenner: restoreTennerService ? (identity, id) => restoreTennerService.restoreTenner(identity, id) : notConfigured,
    getHistory: historyService ? (tenantId, request) => historyService.getHistory(tenantId, request) : notConfigured,
    getTennerHistory: historyService ? (tenantId, id, request) => historyService.getTennerHistory(tenantId, id, request) : notConfigured,
    getTenner: getTennerService ? (tenantId, id, options) => getTennerService.getTenner(tenantId, id, options) : notConfigured,
    getDashboard: dashboardService ? async (tenantId, request) => (await expireHandovers(tenantId), dashboardService.getDashboard(tenantId, request)) : notConfigured,
    completeTenner: completeTennerService
      ? (identity, id, request, key) => completeTennerService.completeTenner(identity, id, request, key)
      : notConfigured,
    undoCompletion: undoCompletionService
      ? (identity, id, request, key) => undoCompletionService.undoLatestCompletion(identity, id, request, key)
      : notConfigured,
    snoozeTenner: snoozeTennerService ? (identity, id, request) => snoozeTennerService.snoozeTenner(identity, id, request) : notConfigured,
    skipTenner: skipTennerService ? (identity, id, request) => skipTennerService.skipTenner(identity, id, request) : notConfigured,
    pauseTenner: pauseTennerService ? (identity, id, request) => pauseTennerService.pause(identity, id, request) : notConfigured,
    resumeTenner: pauseTennerService ? (identity, id) => pauseTennerService.resume(identity, id) : notConfigured,
    setVacation: vacationService ? (identity, request) => vacationService.setVacation(identity, request) : notConfigured,
    endVacation: vacationService ? (identity) => vacationService.endVacation(identity) : notConfigured,
    listMembers: memberService ? (tenantId) => memberService.listMembers(tenantId) : notConfigured,
    createMember: memberService ? (identity, request) => memberService.createMember(identity, request) : notConfigured,
    updateMember: memberService ? (identity, userId, request) => memberService.updateMember(identity, userId, request) : notConfigured,
    deactivateMember: memberDeactivationService ? (identity, userId, request) => memberDeactivationService.deactivate(identity, userId, request) : notConfigured,
    reactivateMember: memberDeactivationService ? (identity, userId) => memberDeactivationService.reactivate(identity, userId) : notConfigured,
    startHandover: handoverService ? (identity, userId, request) => handoverService.start(identity, userId, request) : notConfigured,
    endHandover: handoverService ? (identity, userId) => handoverService.end(identity, userId) : notConfigured,
    listCategories: categoryService ? (tenantId) => categoryService.listCategories(tenantId) : notConfigured,
    createCategory: categoryService ? (identity, request) => categoryService.createCategory(identity, request) : notConfigured,
    updateCategory: categoryService ? (identity, categoryId, request) => categoryService.updateCategory(identity, categoryId, request) : notConfigured,
    getHousehold: householdService ? async (tenantId) => (await expireHandovers(tenantId), householdService.getHousehold(tenantId)) : notConfigured,
    updateHousehold: householdService ? (identity, request) => householdService.updateSettings(identity, request) : notConfigured,
    getOnboarding: householdAssignmentService ? (principal) => householdAssignmentService.getOnboarding(principal) : notConfigured,
    assignHouseholdMember: householdAssignmentService ? (principal, userId) => householdAssignmentService.assign(principal, userId) : notConfigured,
    analyticsSummary: analyticsService ? (tenantId, request) => analyticsService.summary(tenantId, request) : notConfigured,
    analyticsTrends: analyticsService ? (tenantId, request) => analyticsService.trends(tenantId, request) : notConfigured,
    analyticsUsers: analyticsService ? (tenantId, request) => analyticsService.users(tenantId, request) : notConfigured,
    analyticsCategories: analyticsService ? (tenantId, request) => analyticsService.categories(tenantId, request) : notConfigured,
    analyticsNeglected: analyticsService ? (tenantId, request) => analyticsService.neglected(tenantId, request) : notConfigured,
    analyticsBalance: analyticsService ? (tenantId, request) => analyticsService.balance(tenantId, request) : notConfigured,
    analyticsHabits: analyticsService ? (tenantId, request) => analyticsService.habits(tenantId, request) : notConfigured,
    analyticsHabit: analyticsService ? (tenantId, tennerId, request) => analyticsService.habit(tenantId, tennerId, request) : notConfigured,
  };
}

let dependencies: Dependencies | undefined;

export async function handler(event: ApiEvent): Promise<ApiResult> {
  dependencies ??= createDependencies();
  return route(event, dependencies);
}

/** Correlation ID: client-provided header (if sane) or the API Gateway request ID. */
export function correlationIdOf(event: ApiEvent): string {
  const header = event.headers?.[CORRELATION_HEADER];
  if (header && /^[A-Za-z0-9._-]{1,128}$/.test(header)) return header;
  return event.requestContext?.requestId ?? "unknown";
}

/** Public routes run without identity; protected routes first resolve the identity from the JWT claims. */
async function dispatch(event: ApiEvent, deps: Dependencies, requestLogger: Logger): Promise<ApiResult> {
  const publicHandler = PUBLIC_ROUTES[event.routeKey];
  if (publicHandler) return publicHandler({ event, deps, logger: requestLogger });
  const onboardingHandlerForRoute = ONBOARDING_ROUTES[event.routeKey];
  if (onboardingHandlerForRoute) return onboardingHandlerForRoute({ event, deps, logger: requestLogger, principal: principalFromEvent(event) });
  const routeHandler = ROUTES[event.routeKey];
  if (!routeHandler) throw new NotFoundError("Route not found.");
  const identity = identityFromEvent(event);
  return routeHandler({ event, deps, identity, logger: requestLogger.child({ userId: identity.userId }) });
}

/** Dispatch a request to its handler. Exported for tests. */
export async function route(event: ApiEvent, deps: Dependencies): Promise<ApiResult> {
  const correlationId = correlationIdOf(event);
  const logger = deps.logger.child({ correlationId, routeKey: event.routeKey });
  const withCorrelation = (result: ApiResult): ApiResult => ({
    ...result,
    headers: { ...result.headers, [CORRELATION_HEADER]: correlationId },
  });

  try {
    const response = await dispatch(event, deps, logger);
    logger.info("Request handled", { statusCode: response.statusCode });
    return withCorrelation(response);
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof ApplicationError && error.statusCode < 500) {
      logger.warn("Request rejected", { statusCode: response.statusCode, errorCode: error.code });
    } else {
      logger.error("Request failed", { statusCode: response.statusCode, ...errorFields(error) });
    }
    return withCorrelation(response);
  }
}
