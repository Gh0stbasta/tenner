import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { correlationIdOf, createDependencies, handler, route as routeEvent, type Dependencies } from "../src/index.js";
import { toTennerResponse } from "../src/dto/index.js";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../src/models/index.js";
import { CATALOG_INGREDIENTS, DEFAULT_HOUSEHOLD_FOOD_RULES, EMPTY_FOOD_PROFILE, type DishResponse, type ResolvedIngredient } from "../src/meals/index.js";
import { ApplicationError } from "../src/exceptions/index.js";
import { authenticatedEvent, jwtClaims, mockLogger, tennerFixture, testConfig, TEST_IDENTITY } from "./mocks/index.js";

/** Most tests exercise authenticated requests: the event carries the default test user's verified claims. */
const route = (event: APIGatewayProxyEventV2, d: Dependencies) => routeEvent(authenticatedEvent(event), d);

const tennerResponse = toTennerResponse(tennerFixture());
const emptyDashboard = {
  referenceDate: "2026-10-01",
  timezone: "Europe/Berlin",
  summary: { dueTodayCount: 0, overdueCount: 0, upcomingCount: 0, dueTodayMinutes: 0, overdueMinutes: 0, upcomingMinutes: 0, totalActionableCount: 0, totalActionableMinutes: 0 },
  dueToday: [],
  overdue: [],
  upcoming: [],
  paused: [],
  byUser: {},
  byCategory: {},
};

function event(routeKey: string, headers: Record<string, string> = {}, body?: string, query?: Record<string, string>): APIGatewayProxyEventV2 {
  return { routeKey, headers, body, queryStringParameters: query, requestContext: { requestId: "req-1" } } as unknown as APIGatewayProxyEventV2;
}

const household = {
  name: "Unser Haushalt",
  timezone: "Europe/Berlin",
  weekStartsOn: "MONDAY" as const,
  workdays: ["MON", "TUE", "WED", "THU", "FRI"] as const,
  defaults: { category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14 },
  defaultsSource: "DEFAULT" as const,
  handovers: [],
  vacation: null,
};

const PREFERENCES_RESPONSE = { preferences: DEFAULT_NOTIFICATION_PREFERENCES, channels: [], effectiveTimezone: "Europe/Berlin" };
const INGREDIENT = { ...CATALOG_INGREDIENTS[0], source: "CATALOG", overridden: false } as ResolvedIngredient;
const DISH_ID = "6f9619ff-8b86-4d11-b42d-00c04fc964ff";
const DISH = {
  dishId: DISH_ID,
  name: "Onigiri",
  category: "VEGETARIAN",
  slots: ["LUNCH"],
  lightness: "LIGHT",
  temperature: "COLD",
  ingredients: [{ ingredientId: "sushi-rice", quantity: 80, unit: "g", optional: false }],
  activeMinutes: 15,
  totalMinutes: 30,
  familyFriendly: true,
  isBurger: false,
  favorite: false,
  archived: false,
  createdAt: "2026-10-07T10:00:00Z",
  updatedAt: "2026-10-07T10:00:00Z",
  isVegetarian: true,
  tags: [],
  optionalTags: [],
  proteinSources: [],
  baseTags: ["RICE"],
  containsPoultry: false,
  unknownIngredients: [],
} as DishResponse;
const EMPTY_SHOPPING_LIST = { weekStart: "2026-10-12", range: "REST" as const, generatedAt: "2026-10-12T08:00:00Z", stale: false, items: [] };
const EMPTY_PLAN = { weekStart: "2026-10-12", weekEnd: "2026-10-18", ready: false, setup: { hasDishes: false, hasEaters: false }, generatedAt: null, slots: [], violations: [] };
const ALEXA_CONTEXT = { account: { userId: "STEFAN" }, timezone: "Europe/Berlin", members: [{ userId: "STEFAN", displayName: "Stefan" }], speakers: [], alexaAccounts: 0 };

function deps(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    config: testConfig(),
    logger: mockLogger(),
    probeDatabase: async () => true,
    createTenner: vi.fn(async () => tennerResponse),
    listTenners: vi.fn(async () => [tennerResponse]),
    updateTenner: vi.fn(async () => tennerResponse),
    completeTenner: vi.fn(async () => ({
      response: {
        tenner: tennerResponse,
        completion: { completionId: "c-1", tennerId: "t-1", completedBy: "STEFAN" as const, completedAt: "2026-10-01T18:30:00Z", actualMinutes: 10 },
      },
      replayed: false,
    })),
    snoozeTenner: vi.fn(async () => ({
      tenner: tennerResponse,
      snooze: { snoozeId: "s-1", snoozedBy: "STEFAN" as const, snoozedAt: "2026-10-01T18:30:00Z", previousNextDue: "2026-10-01", snoozedUntil: "2026-10-04" },
    })),
    skipTenner: vi.fn(async () => ({
      tenner: tennerResponse,
      skip: { skipId: "k-1", skippedBy: "STEFAN" as const, skippedAt: "2026-10-01T18:30:00Z", skippedDue: "2026-10-01", nextDue: "2026-10-15", reason: null },
    })),
    getDashboard: vi.fn(async () => emptyDashboard),
    getTenner: vi.fn(async () => tennerResponse),
    getHistory: vi.fn(async () => ({ items: [], nextCursor: null })),
    getTennerHistory: vi.fn(async () => ({ items: [], nextCursor: null })),
    restoreTenner: vi.fn(async () => ({ response: { tennerId: "t-1", active: true, deletedAt: null }, status: "RESTORED" as const, previousDeletedAt: "2026-10-01T18:00:00Z" })),
    undoCompletion: vi.fn(async () => ({
      response: {
        tenner: tennerResponse,
        revertedCompletion: {
          completionId: "c-1",
          completedBy: "STEFAN" as const,
          completedAt: "2026-10-01T18:30:00Z",
          actualMinutes: 10,
          revertedAt: "2026-10-01T19:00:00Z",
          revertedBy: "JULIA" as const,
          revertReason: null,
        },
      },
      restoredPrevious: false,
      replayed: false,
    })),
    deleteTenner: vi.fn(async () => ({ response: { tennerId: "t-1", deleted: true as const }, outcome: { status: "DELETED" as const, tenner: tennerFixture() } })),
    getHousehold: vi.fn(async () => household),
    updateHousehold: vi.fn(async () => household),
    pauseTenner: vi.fn(async () => tennerResponse),
    resumeTenner: vi.fn(async () => tennerResponse),
    setVacation: vi.fn(async () => ({ household: { ...household, vacation: { from: "2026-10-10", until: "2026-10-24", categories: null } }, rescheduled: 2, conflicts: 0 })),
    endVacation: vi.fn(async () => household),
    importCatalog: vi.fn(async () => ({ dryRun: false, membersCreated: [], tennersCreated: [], tennersSkipped: [] })),
    subscribePush: vi.fn(async () => 1),
    handlePushAction: vi.fn(async () => ({ action: "SNOOZE" as const, result: "SNOOZED" as const, remindAt: "2026-10-07T09:00:00Z" })),
    unsubscribePush: vi.fn(async () => undefined),
    listMembers: vi.fn(async () => [{ userId: "STEFAN", displayName: "Stefan", color: "BLUE" as const, active: true , canSignIn: true}]),
    createMember: vi.fn(async () => ({ userId: "LENA", displayName: "Lena", color: "GREEN" as const, active: true , canSignIn: true})),
    updateMember: vi.fn(async () => ({ userId: "STEFAN", displayName: "Steffen", color: "BLUE" as const, active: true , canSignIn: true})),
    deactivateMember: vi.fn(async () => ({ member: { userId: "JULIA", displayName: "Julia", color: "PURPLE" as const, active: false , canSignIn: true}, reassigned: 2, reassignedTo: "STEFAN", revokedAccounts: 1 })),
    reactivateMember: vi.fn(async () => ({ userId: "JULIA", displayName: "Julia", color: "PURPLE" as const, active: true , canSignIn: true})),
    startHandover: vi.fn(async () => ({ handover: { from: "JULIA", to: "STEFAN", until: "2026-10-12", categories: null }, handedOver: 3 })),
    endHandover: vi.fn(async () => ({ returned: 3 })),
    getAlexaContext: vi.fn(async () => ALEXA_CONTEXT),
    registerAlexaUser: vi.fn(async () => undefined),
    getNotificationPreferences: vi.fn(async () => PREFERENCES_RESPONSE),
    updateNotificationPreferences: vi.fn(async () => PREFERENCES_RESPONSE),
    linkAlexaSpeaker: vi.fn(async () => ALEXA_CONTEXT),
    unlinkAlexaSpeaker: vi.fn(async () => ALEXA_CONTEXT),
    analyticsTrends: vi.fn(async () => ({ granularity: "week" as const, period: { from: "a", to: "b" }, buckets: [], comparison: { previousPeriod: { from: "a", to: "b" }, previousPeriodCompletions: 0, changePercent: null } })),
    analyticsUsers: vi.fn(async () => ({ period: { from: "a", to: "b" }, users: [], shared: { assignedActive: 0, assignedOverdue: 0 } })),
    analyticsCategories: vi.fn(async () => ({ period: { from: "a", to: "b" }, categories: [] })),
    analyticsNeglected: vi.fn(async () => ({ period: { from: "a", to: "b" }, items: [] })),
    analyticsBalance: vi.fn(async () => ({ period: { from: "a", to: "b" }, byUser: [], byCategory: [], balanceIndex: null })),
    analyticsHabits: vi.fn(async () => ({ period: { from: "a", to: "b" }, householdConsistency: null, items: [] })),
    analyticsHabit: vi.fn(async () => ({ period: { from: "a", to: "b" }, tennerId: "t-1", title: "x", currentStreak: 0, longestStreak: 0, consistencyScore: null, trend: null, frequencyDays: 7, expectedCompletions: 0, actualCompletions: 0, completionDates: [], intervals: [] })),
    analyticsTime: vi.fn(async () => ({ period: { from: "a", to: "b" }, totalActualMinutes: 0, averageMinutesPerWeek: 0, projectedMinutesPerWeek: 0, estimationAccuracy: null, reportedSamples: 0, tennersExceedingEstimate: [], tennersExceedingTenMinutes: 0 })),
    analyticsSummary: vi.fn(async () => ({ period: { from: "2026-09-06", to: "2026-10-05" }, completions: 0, totalActualMinutes: 0, activeTenners: 0, distinctTennersCompleted: 0, overdueNow: 0, onTimeRate: null, onTimeSamples: 0 })),
    listCategories: vi.fn(async () => [{ categoryId: "HOUSEHOLD", name: "Haushalt", icon: "CLEANING" as const, color: "BLUE" as const, sortOrder: 0, archived: false }]),
    createCategory: vi.fn(async () => ({ categoryId: "GARDEN", name: "Garten", icon: "GARDEN" as const, color: "GREEN" as const, sortOrder: 6, archived: false })),
    updateCategory: vi.fn(async () => ({ categoryId: "HOUSEHOLD", name: "Haushalt", icon: "CLEANING" as const, color: "BLUE" as const, sortOrder: 0, archived: true })),
    getOnboarding: vi.fn(async () => ({ assignedTo: null, members: [] })),
    assignHouseholdMember: vi.fn(async () => ({ response: { userId: "JULIA" as const }, group: "household:default:JULIA" })),
    listIngredients: vi.fn(async () => [INGREDIENT]),
    createIngredient: vi.fn(async () => INGREDIENT),
    updateIngredient: vi.fn(async () => INGREDIENT),
    listDishes: vi.fn(async () => [DISH]),
    getDish: vi.fn(async () => DISH),
    createDish: vi.fn(async () => DISH),
    updateDish: vi.fn(async () => DISH),
    archiveDish: vi.fn(async () => DISH),
    restoreDish: vi.fn(async () => DISH),
    getFoodProfile: vi.fn(async () => EMPTY_FOOD_PROFILE),
    updateFoodProfile: vi.fn(async () => EMPTY_FOOD_PROFILE),
    getMealPlan: vi.fn(async () => EMPTY_PLAN),
    replaceMeal: vi.fn(async () => EMPTY_PLAN),
    mealOptions: vi.fn(async () => []),
    chooseMeal: vi.fn(async () => EMPTY_PLAN),
    swapMeals: vi.fn(async () => EMPTY_PLAN),
    regenerateWeek: vi.fn(async () => ({ ...EMPTY_PLAN, regeneration: { changed: 0, kept: 0 } })),
    getShoppingList: vi.fn(async () => EMPTY_SHOPPING_LIST),
    refreshShoppingList: vi.fn(async () => EMPTY_SHOPPING_LIST),
    changeShoppingList: vi.fn(async () => EMPTY_SHOPPING_LIST),
    importMealCatalog: vi.fn(async (_identity: unknown, dryRun: boolean) => ({ dryRun, dishesCreated: ["Onigiri"], dishesSkipped: [] })),
    ...overrides,
  };
}

function body(response: { body?: string | undefined }): { success?: boolean; error?: { code: string; message: string; details?: unknown } } {
  return JSON.parse(response.body ?? "") as never;
}

afterEach(() => vi.restoreAllMocks());

describe("route", () => {
  it("routes GET /health", async () => {
    const response = await route(event("GET /health"), deps());
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "").database).toBe("connected");
  });

  it("returns 404 NOT_FOUND for unknown routes and logs a warning", async () => {
    const d = deps();
    const response = await route(event("POST /health"), d);
    expect(response.statusCode).toBe(404);
    expect(body(response)).toEqual({ success: false, error: { code: "NOT_FOUND", message: "Route not found." } });
    expect(d.logger.warn).toHaveBeenCalledWith("Request rejected", { statusCode: 404, errorCode: "NOT_FOUND" });
  });

  it("returns 500 without internal details for unexpected errors", async () => {
    const d = deps({
      probeDatabase: async () => {
        throw new Error("secret detail");
      },
    });
    const response = await route(event("GET /health"), d);
    expect(response.statusCode).toBe(500);
    expect(body(response).error).toEqual({ code: "INTERNAL_ERROR", message: "Internal server error." });
    expect(response.body).not.toContain("secret detail");
    expect(d.logger.error).toHaveBeenCalledOnce();
  });

  it.each([
    [new ValidationError("Validation failed.", [{ field: "title", message: "Too short" }]), 400, "VALIDATION_ERROR"],
    [new ConflictError("Inactive Tenners cannot be completed.", "TENNER_INACTIVE"), 409, "TENNER_INACTIVE"],
    [new PersistenceError("A storage error occurred.", { cause: new Error("ddb down") }), 500, "PERSISTENCE_ERROR"],
  ])("maps %s to its status and code", async (error, status, code) => {
    const d = deps({
      probeDatabase: async () => {
        throw error;
      },
    });
    const response = await route(event("GET /health"), d);
    expect(response.statusCode).toBe(status);
    expect(body(response).error?.code).toBe(code);
    expect(response.body).not.toContain("ddb down");
  });

  it("returns the correlation id header and binds it to the request logger", async () => {
    const d = deps();
    const response = await route(event("GET /health", { "x-correlation-id": "abc-123" }), d);
    expect(response.headers?.["x-correlation-id"]).toBe("abc-123");
    expect(d.logger.child).toHaveBeenCalledWith({ correlationId: "abc-123", routeKey: "GET /health", client: "web" });
  });

  it("names the Alexa channel in the request logger for the Alexa app client (ALEXA-002)", async () => {
    const d = deps({ config: testConfig({ alexaClientId: "alexa-client" }) });
    const alexaEvent = authenticatedEvent(event("GET /dashboard"), { "cognito:groups": "[household:default:STEFAN]", username: "google_1", client_id: "alexa-client" });
    const response = await routeEvent(alexaEvent, d);
    expect(response.statusCode).toBe(200);
    expect(d.logger.child).toHaveBeenCalledWith(expect.objectContaining({ client: "alexa" }));
  });

  it.each([
    ["GET /household/alexa", undefined, "getAlexaContext"],
    ["PUT /household/alexa-speakers/{personId}", JSON.stringify({ userId: "JULIA" }), "linkAlexaSpeaker"],
    ["DELETE /household/alexa-speakers/{personId}", undefined, "unlinkAlexaSpeaker"],
    ["GET /users/{userId}/notification-preferences", undefined, "getNotificationPreferences"],
    ["PUT /household/alexa-users/{alexaUserId}", undefined, "registerAlexaUser"],
  ] as const)("routes %s (ALEXA-002)", async (routeKey, body, dependency) => {
    const d = deps();
    const response = await route({ ...event(routeKey), pathParameters: { personId: "amzn1.ask.person.ABC", userId: "STEFAN", alexaUserId: "amzn1.ask.account.ABC" }, ...(body ? { body } : {}) }, d);
    expect(response.statusCode).toBe(200);
    expect(d[dependency]).toHaveBeenCalledOnce();
  });
});

describe("authentication (SECURITY-004)", () => {
  const PROTECTED = [
    "POST /tenners",
    "GET /tenners",
    "GET /tenners/{tennerId}",
    "GET /history",
    "GET /tenners/{tennerId}/history",
    "PUT /tenners/{tennerId}",
    "DELETE /tenners/{tennerId}",
    "POST /tenners/{tennerId}/complete",
    "POST /tenners/{tennerId}/undo-completion",
    "POST /tenners/{tennerId}/restore",
    "GET /dashboard",
  ];

  it.each(PROTECTED)("rejects %s without verified claims with 401 before any service call", async (routeKey) => {
    const d = deps();
    const response = await routeEvent(event(routeKey, {}, "{}"), d);
    expect(response.statusCode).toBe(401);
    expect(body(response).error?.code).toBe("UNAUTHORIZED");
    for (const service of [d.createTenner, d.listTenners, d.getTenner, d.getHistory, d.getTennerHistory, d.updateTenner, d.deleteTenner, d.completeTenner, d.undoCompletion, d.restoreTenner, d.getDashboard]) {
      expect(service).not.toHaveBeenCalled();
    }
  });

  it("keeps GET /health public", async () => {
    expect((await routeEvent(event("GET /health"), deps())).statusCode).toBe(200);
  });

  it("rejects a signed-in account without household group with 403", async () => {
    const d = deps();
    const response = await routeEvent(authenticatedEvent(event("GET /tenners"), { sub: "x", email: "user@example.com" }), d);
    expect(response.statusCode).toBe(403);
    expect(body(response).error?.code).toBe("FORBIDDEN");
    expect(d.listTenners).not.toHaveBeenCalled();
  });

  it("passes the tenant from the claims to read and write services", async () => {
    const d = deps();
    const claims = jwtClaims({ tenantId: "household-2", userId: "JULIA" });
    await routeEvent(authenticatedEvent(event("GET /tenners"), claims), d);
    await routeEvent(authenticatedEvent({ ...event("DELETE /tenners/{tennerId}"), pathParameters: { tennerId: "t-1" } }, claims), d);
    expect(d.listTenners).toHaveBeenCalledWith("household-2", {});
    expect(d.deleteTenner).toHaveBeenCalledWith({ tenantId: "household-2", userId: "JULIA" }, "t-1");
  });

  it("rejects a tenantId query parameter with 400 (no client-controlled tenant selection)", async () => {
    const d = deps();
    const response = await route(event("GET /tenners", {}, undefined, { tenantId: "other" }), d);
    expect(response.statusCode).toBe(400);
    expect(d.listTenners).not.toHaveBeenCalled();
  });

  it("binds the acting user to the request logger", async () => {
    const d = deps();
    await route(event("GET /tenners"), d);
    expect(d.logger.child).toHaveBeenCalledWith({ userId: TEST_IDENTITY.userId });
  });
});

describe("onboarding routes (HOTFIX-001)", () => {
  it("GET /onboarding works for a signed-in user without household group", async () => {
    const d = deps();
    const response = await routeEvent(authenticatedEvent(event("GET /onboarding"), { "cognito:username": "google_9" }), d);
    expect(response.statusCode).toBe(200);
    expect(d.getOnboarding).toHaveBeenCalledWith({ username: "google_9" });
  });

  it("POST /onboarding/assignment passes the principal and the chosen member", async () => {
    const d = deps();
    const response = await routeEvent(authenticatedEvent(event("POST /onboarding/assignment", {}, JSON.stringify({ userId: "JULIA" })), { "cognito:username": "google_9" }), d);
    expect(response.statusCode).toBe(201);
    expect(d.assignHouseholdMember).toHaveBeenCalledWith({ username: "google_9" }, "JULIA");
  });

  it("rejects onboarding without verified claims with 401", async () => {
    const d = deps();
    expect((await routeEvent(event("GET /onboarding"), d)).statusCode).toBe(401);
    expect(d.getOnboarding).not.toHaveBeenCalled();
  });

  it("still blocks household routes for users without a group (403)", async () => {
    const d = deps();
    expect((await routeEvent(authenticatedEvent(event("GET /tenners"), { "cognito:username": "google_9" }), d)).statusCode).toBe(403);
  });
});

describe("POST /tenners", () => {
  const valid = { title: "Vacuum Office", category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14, assignedTo: "STEFAN" };

  it("creates a Tenner for the configured tenant and returns 201", async () => {
    const d = deps();
    const response = await route(event("POST /tenners", {}, JSON.stringify(valid)), d);
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: tennerResponse });
    expect(d.createTenner).toHaveBeenCalledWith(TEST_IDENTITY, { ...valid, frequencyUnit: "DAY", frequencyInterval: valid.frequencyDays, weekdays: null, assignmentMode: "FIXED", rotation: null });
  });

  it("rejects invalid input with 400 before calling the service", async () => {
    const d = deps();
    const response = await route(event("POST /tenners", {}, JSON.stringify({ ...valid, frequencyDays: 0 })), d);
    expect(response.statusCode).toBe(400);
    expect(body(response).error?.code).toBe("VALIDATION_ERROR");
    expect(d.createTenner).not.toHaveBeenCalled();
  });

  it("returns 503 when the tables are not configured", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await route(event("POST /tenners", {}, JSON.stringify(valid)), createDependencies(testConfig({ tables: undefined })));
    expect(response.statusCode).toBe(503);
    expect(body(response).error?.code).toBe("SERVICE_UNAVAILABLE");
  });
});

describe("GET /tenners", () => {
  it("lists Tenners with parsed filters", async () => {
    const d = deps();
    const response = await route(event("GET /tenners", {}, undefined, { assignedTo: "JULIA", due: "true", sort: "title" }), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: [tennerResponse] });
    expect(d.listTenners).toHaveBeenCalledWith("default", { assignedTo: "JULIA", due: true, sort: "title" });
  });

  it("lists without query parameters", async () => {
    const d = deps();
    await route(event("GET /tenners"), d);
    expect(d.listTenners).toHaveBeenCalledWith("default", {});
  });

  it("parses the archive filter deleted=true (TICKET-024)", async () => {
    const d = deps();
    await route(event("GET /tenners", {}, undefined, { deleted: "true" }), d);
    expect(d.listTenners).toHaveBeenCalledWith("default", { deleted: true });
  });

  it.each([{ sort: "priority" }, { assignedTo: "bob" }, { active: "yes" }, { deleted: "yes" }, { order: "up" }, { unknown: "1" }])("rejects %j with 400", async (query) => {
    const d = deps();
    const response = await route(event("GET /tenners", {}, undefined, query), d);
    expect(response.statusCode).toBe(400);
    expect(d.listTenners).not.toHaveBeenCalled();
  });
});

describe("POST /tenners/{tennerId}/snooze (SCHEDULING-003)", () => {
  it("snoozes and returns 200", async () => {
    const d = deps();
    const response = await route({ ...event("POST /tenners/{tennerId}/snooze", {}, JSON.stringify({ days: 3 })), pathParameters: { tennerId: "t-1" } } as APIGatewayProxyEventV2, d);
    expect(response.statusCode).toBe(200);
    expect(d.snoozeTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", { days: 3 });
  });

  it("rejects requests with both until and days", async () => {
    const d = deps();
    const response = await route({ ...event("POST /tenners/{tennerId}/snooze", {}, JSON.stringify({ days: 3, until: "2026-10-08" })), pathParameters: { tennerId: "t-1" } } as APIGatewayProxyEventV2, d);
    expect(response.statusCode).toBe(400);
    expect(d.snoozeTenner).not.toHaveBeenCalled();
  });
});

describe("POST /tenners/{tennerId}/skip (SCHEDULING-004)", () => {
  it("skips and returns 200", async () => {
    const d = deps();
    const response = await route({ ...event("POST /tenners/{tennerId}/skip"), pathParameters: { tennerId: "t-1" } } as APIGatewayProxyEventV2, d);
    expect(response.statusCode).toBe(200);
    expect(d.skipTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", {});
  });
});

describe("pause and vacation routes (SCHEDULING-005)", () => {
  const withId = (routeKey: string, body?: string) => ({ ...event(routeKey, {}, body), pathParameters: { tennerId: "t-1" } }) as APIGatewayProxyEventV2;

  it("pauses and resumes", async () => {
    const d = deps();
    expect((await route(withId("POST /tenners/{tennerId}/pause", JSON.stringify({ until: "2026-10-12" })), d)).statusCode).toBe(200);
    expect(d.pauseTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", { until: "2026-10-12" });
    expect((await route(withId("POST /tenners/{tennerId}/resume"), d)).statusCode).toBe(200);
    expect(d.resumeTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1");
  });

  it("sets and ends the vacation", async () => {
    const d = deps();
    const set = await route(event("PUT /household/vacation", {}, JSON.stringify({ from: "2026-10-10", until: "2026-10-24" })), d);
    expect(set.statusCode).toBe(200);
    expect(d.setVacation).toHaveBeenCalledWith(TEST_IDENTITY, { from: "2026-10-10", until: "2026-10-24" });
    expect((await route(event("DELETE /household/vacation"), d)).statusCode).toBe(200);
    expect(d.endVacation).toHaveBeenCalledWith(TEST_IDENTITY);
  });
});

describe("member routes (HOUSEHOLD-ADMIN-001)", () => {
  it("lists, creates and updates members", async () => {
    const d = deps();
    expect((await route(event("GET /users"), d)).statusCode).toBe(200);
    expect(d.listMembers).toHaveBeenCalledWith("default");
    expect((await route(event("POST /users", {}, JSON.stringify({ displayName: "Lena", color: "GREEN" })), d)).statusCode).toBe(201);
    const put = { ...event("PUT /users/{userId}", {}, JSON.stringify({ displayName: "Steffen" })), pathParameters: { userId: "STEFAN" } } as APIGatewayProxyEventV2;
    expect((await route(put, d)).statusCode).toBe(200);
    expect(d.updateMember).toHaveBeenCalledWith(TEST_IDENTITY, "STEFAN", { displayName: "Steffen" });
  });
});

describe("member deactivation routes (HOUSEHOLD-ADMIN-004)", () => {
  it("deactivates and reactivates members", async () => {
    const d = deps();
    const withUser = (routeKey: string, body?: string) => ({ ...event(routeKey, {}, body), pathParameters: { userId: "JULIA" } }) as APIGatewayProxyEventV2;
    expect((await route(withUser("POST /users/{userId}/deactivate", JSON.stringify({ reassignTo: "STEFAN" })), d)).statusCode).toBe(200);
    expect(d.deactivateMember).toHaveBeenCalledWith(TEST_IDENTITY, "JULIA", { reassignTo: "STEFAN" });
    expect((await route(withUser("POST /users/{userId}/reactivate"), d)).statusCode).toBe(200);
    expect(d.reactivateMember).toHaveBeenCalledWith(TEST_IDENTITY, "JULIA");
  });

  it("starts and ends a handover (HOUSEHOLD-004)", async () => {
    const d = deps();
    const withUser = (routeKey: string, body?: string) => ({ ...event(routeKey, {}, body), pathParameters: { userId: "JULIA" } }) as APIGatewayProxyEventV2;
    const start = await route(withUser("POST /users/{userId}/handover", JSON.stringify({ to: "STEFAN", until: "2026-10-12" })), d);
    expect(start.statusCode).toBe(201);
    expect(d.startHandover).toHaveBeenCalledWith(TEST_IDENTITY, "JULIA", { to: "STEFAN", until: "2026-10-12" });
    expect((await route(withUser("POST /users/{userId}/handover", JSON.stringify({ to: "STEFAN", until: "12.10.2026" })), d)).statusCode).toBe(400);
    expect((await route(withUser("POST /users/{userId}/handover", JSON.stringify({ to: "STEFAN", until: "2026-10-12", categories: [] })), d)).statusCode).toBe(400);
    expect((await route(withUser("DELETE /users/{userId}/handover"), d)).statusCode).toBe(200);
    expect(d.endHandover).toHaveBeenCalledWith(TEST_IDENTITY, "JULIA");
  });
});

describe("category routes (HOUSEHOLD-ADMIN-002)", () => {
  it("lists, creates and updates categories", async () => {
    const d = deps();
    expect((await route(event("GET /categories"), d)).statusCode).toBe(200);
    expect((await route(event("POST /categories", {}, JSON.stringify({ name: "Garten", icon: "GARDEN", color: "GREEN" })), d)).statusCode).toBe(201);
    const put = { ...event("PUT /categories/{categoryId}", {}, JSON.stringify({ archived: true })), pathParameters: { categoryId: "HOUSEHOLD" } } as APIGatewayProxyEventV2;
    expect((await route(put, d)).statusCode).toBe(200);
    expect(d.updateCategory).toHaveBeenCalledWith(TEST_IDENTITY, "HOUSEHOLD", { archived: true });
  });
});

describe("ingredient routes (FOOD-021)", () => {
  it("lists, creates and updates ingredients", async () => {
    const d = deps();
    const list = await route(event("GET /meals/ingredients"), d);
    expect(list.statusCode).toBe(200);
    expect(JSON.parse(list.body as string).data.ingredients).toHaveLength(1);
    expect((await route(event("POST /meals/ingredients", {}, JSON.stringify({ name: "Rote Bete", unit: "g" })), d)).statusCode).toBe(201);
    expect((await route(event("POST /meals/ingredients", {}, JSON.stringify({ name: "Rote Bete", unit: "kg" })), d)).statusCode).toBe(400);
    const put = { ...event("PUT /meals/ingredients/{ingredientId}", {}, JSON.stringify({ pricePerUnit: 3 })), pathParameters: { ingredientId: "salmon" } } as APIGatewayProxyEventV2;
    expect((await route(put, d)).statusCode).toBe(200);
    expect(d.updateIngredient).toHaveBeenCalledWith(TEST_IDENTITY, "salmon", { pricePerUnit: 3 });
    const badId = { ...put, pathParameters: { ingredientId: "Lachs!" } } as APIGatewayProxyEventV2;
    expect((await route(badId, d)).statusCode).toBe(400);
  });

  it("answers 503 while the meals table is not configured", async () => {
    const response = await route(event("GET /meals/ingredients"), deps({ listIngredients: async () => { throw new ApplicationError("SERVICE_UNAVAILABLE", 503, "Service is not configured."); } }));
    expect(response.statusCode).toBe(503);
  });
});

describe("dish routes (FOOD-002)", () => {
  const withDish = (routeKey: string, body?: string, dishId: string = DISH_ID) => ({ ...event(routeKey, {}, body), pathParameters: { dishId } }) as APIGatewayProxyEventV2;

  it("lists dishes with validated filters", async () => {
    const d = deps();
    expect((await route(event("GET /meals/dishes", {}, undefined, { slot: "LUNCH", archived: "true" }), d)).statusCode).toBe(200);
    expect(d.listDishes).toHaveBeenCalledWith("default", { slot: "LUNCH", archived: true });
    expect((await route(event("GET /meals/dishes", {}, undefined, { slot: "BREAKFAST" }), d)).statusCode).toBe(400);
  });

  it("creates, reads, updates, archives and restores dishes", async () => {
    const d = deps();
    const body = { name: "Onigiri", category: "VEGETARIAN", slots: ["LUNCH"], lightness: "LIGHT", temperature: "COLD", ingredients: [{ ingredientId: "sushi-rice", quantity: 80, unit: "g" }], activeMinutes: 15 };
    expect((await route(event("POST /meals/dishes", {}, JSON.stringify(body)), d)).statusCode).toBe(201);
    expect((await route(withDish("GET /meals/dishes/{dishId}"), d)).statusCode).toBe(200);
    expect((await route(withDish("PUT /meals/dishes/{dishId}", JSON.stringify({ favorite: true })), d)).statusCode).toBe(200);
    expect(d.updateDish).toHaveBeenCalledWith(TEST_IDENTITY, DISH_ID, { favorite: true });
    expect((await route(withDish("DELETE /meals/dishes/{dishId}"), d)).statusCode).toBe(200);
    expect((await route(withDish("POST /meals/dishes/{dishId}/restore"), d)).statusCode).toBe(200);
    expect(d.restoreDish).toHaveBeenCalledWith(TEST_IDENTITY, DISH_ID);
  });

  it("rejects invalid dish IDs and bodies", async () => {
    const d = deps();
    expect((await route(withDish("GET /meals/dishes/{dishId}", undefined, "not-a-uuid"), d)).statusCode).toBe(400);
    expect((await route(event("POST /meals/dishes", {}, JSON.stringify({ name: "X" })), d)).statusCode).toBe(400);
    expect((await route(withDish("PUT /meals/dishes/{dishId}", JSON.stringify({})), d)).statusCode).toBe(400);
  });
});

describe("food profile routes (FOOD-004)", () => {
  it("reads and replaces the profile without logging its values", async () => {
    const logger = mockLogger();
    const d = deps({ logger });
    expect((await route(event("GET /meals/profile"), d)).statusCode).toBe(200);
    const body = { eaters: [{ name: "Erwachsener 1", type: "ADULT", allergies: ["NUTS", "APPLE"] }], household: DEFAULT_HOUSEHOLD_FOOD_RULES };
    expect((await route(event("PUT /meals/profile", {}, JSON.stringify(body)), d)).statusCode).toBe(200);
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain("NUTS");
    expect((await route(event("PUT /meals/profile", {}, JSON.stringify({ eaters: [] })), d)).statusCode).toBe(400);
  });
});

describe("meal catalog route (FOOD-003)", () => {
  it("previews with a dry run and imports otherwise", async () => {
    const d = deps();
    expect((await route(event("POST /meals/catalog", {}, JSON.stringify({ dryRun: true })), d)).statusCode).toBe(200);
    expect(d.importMealCatalog).toHaveBeenLastCalledWith(TEST_IDENTITY, true);
    expect((await route(event("POST /meals/catalog"), d)).statusCode).toBe(200);
    expect(d.importMealCatalog).toHaveBeenLastCalledWith(TEST_IDENTITY, false);
    expect((await route(event("POST /meals/catalog", {}, JSON.stringify({ dryRun: "yes" })), d)).statusCode).toBe(400);
  });
});

describe("meal plan routes (FOOD-006)", () => {
  const plan = (week: string | undefined) => ({ ...event("GET /meals/plans/{weekStart}"), pathParameters: week === undefined ? undefined : { weekStart: week } }) as APIGatewayProxyEventV2;

  it("accepts current, next and a date", async () => {
    const d = deps();
    for (const week of ["current", "next", "2026-10-12"]) expect((await route(plan(week), d)).statusCode).toBe(200);
    expect(d.getMealPlan).toHaveBeenLastCalledWith("default", "2026-10-12");
    expect((await route(plan("last"), d)).statusCode).toBe(400);
    expect((await route(plan("2026-13-01"), d)).statusCode).toBe(400);
  });

  it("replaces a meal or puts a dish back (FOOD-007)", async () => {
    const d = deps();
    const replace = (slotId: string, body?: string) => ({ ...event("POST /meals/plans/{weekStart}/slots/{slotId}/replace", {}, body), pathParameters: { weekStart: "current", slotId } }) as APIGatewayProxyEventV2;
    expect((await route(replace("2026-10-14#DINNER"), d)).statusCode).toBe(200);
    expect(d.replaceMeal).toHaveBeenLastCalledWith(TEST_IDENTITY, "current", "2026-10-14#DINNER", {});
    expect((await route(replace("2026-10-14#DINNER", JSON.stringify({ excludeDishIds: ["a"] })), d)).statusCode).toBe(200);
    expect(d.replaceMeal).toHaveBeenLastCalledWith(TEST_IDENTITY, "current", "2026-10-14#DINNER", { excludeDishIds: ["a"] });
    expect((await route(replace("2026-10-14#DINNER", JSON.stringify({ dishId: "b" })), d)).statusCode).toBe(200);
    expect(d.replaceMeal).toHaveBeenLastCalledWith(TEST_IDENTITY, "current", "2026-10-14#DINNER", { dishId: "b" });
    expect((await route(replace("2026-10-14%23LUNCH"), d)).statusCode).toBe(200);
    expect(d.replaceMeal).toHaveBeenLastCalledWith(TEST_IDENTITY, "current", "2026-10-14#LUNCH", {});
    expect((await route(replace("2026-10-14#BREAKFAST"), d)).statusCode).toBe(400);
    expect((await route(replace("%E0%A4%A"), d)).statusCode).toBe(400);
    expect((await route(replace("2026-10-14#DINNER", JSON.stringify({ other: 1 })), d)).statusCode).toBe(400);
  });

  it("lists options, chooses, locks and swaps meals (FOOD-022)", async () => {
    const d = deps();
    const slotEvent = (key: string, slotId: string, body?: string) => ({ ...event(key, {}, body), pathParameters: { weekStart: "next", slotId } }) as APIGatewayProxyEventV2;
    const options = await route(slotEvent("GET /meals/plans/{weekStart}/slots/{slotId}/options", "2026-10-14%23DINNER"), d);
    expect(options.statusCode).toBe(200);
    expect(JSON.parse(options.body ?? "{}")).toEqual({ success: true, data: { options: [] } });
    expect(d.mealOptions).toHaveBeenLastCalledWith("default", "next", "2026-10-14#DINNER");

    const choose = (body?: string) => route(slotEvent("PUT /meals/plans/{weekStart}/slots/{slotId}", "2026-10-14#DINNER", body), d);
    expect((await choose(JSON.stringify({ dishId: "a", confirm: true }))).statusCode).toBe(200);
    expect(d.chooseMeal).toHaveBeenLastCalledWith(TEST_IDENTITY, "next", "2026-10-14#DINNER", { dishId: "a", confirm: true });
    expect((await choose(JSON.stringify({ locked: false }))).statusCode).toBe(200);
    expect(d.chooseMeal).toHaveBeenLastCalledWith(TEST_IDENTITY, "next", "2026-10-14#DINNER", { locked: false });
    expect((await choose(JSON.stringify({ confirm: true }))).statusCode).toBe(400);
    expect((await choose()).statusCode).toBe(400);

    const swap = (body: unknown) => route({ ...event("POST /meals/plans/{weekStart}/swap", {}, JSON.stringify(body)), pathParameters: { weekStart: "current" } } as APIGatewayProxyEventV2, d);
    expect((await swap({ from: "2026-10-14#DINNER", to: "2026-10-16#DINNER" })).statusCode).toBe(200);
    expect(d.swapMeals).toHaveBeenLastCalledWith(TEST_IDENTITY, "current", { from: "2026-10-14#DINNER", to: "2026-10-16#DINNER" });
    expect((await swap({ from: "2026-10-14#DINNER" })).statusCode).toBe(400);
  });

  it("regenerates a week or restores the previous dishes (FOOD-008)", async () => {
    const d = deps();
    const regenerate = (body?: unknown) =>
      route({ ...event("POST /meals/plans/{weekStart}/regenerate", {}, body === undefined ? undefined : JSON.stringify(body)), pathParameters: { weekStart: "next" } } as APIGatewayProxyEventV2, d);
    expect((await regenerate()).statusCode).toBe(200);
    expect(d.regenerateWeek).toHaveBeenLastCalledWith(TEST_IDENTITY, "next", {});
    const restore = [{ slotId: "2026-10-14#DINNER", dishId: "a" }, { slotId: "2026-10-15#LUNCH", dishId: null }];
    expect((await regenerate({ restore })).statusCode).toBe(200);
    expect(d.regenerateWeek).toHaveBeenLastCalledWith(TEST_IDENTITY, "next", { restore });
    expect((await regenerate({ restore: [] })).statusCode).toBe(400);
    expect((await regenerate({ restore: [{ slotId: "x", dishId: "a" }] })).statusCode).toBe(400);
  });

  it("reads, refreshes and changes the shopping list (FOOD-014)", async () => {
    const d = deps();
    const list = (key: string, body?: unknown) =>
      route({ ...event(key, {}, body === undefined ? undefined : JSON.stringify(body)), pathParameters: { weekStart: "current" } } as APIGatewayProxyEventV2, d);
    expect((await list("GET /meals/plans/{weekStart}/shopping-list")).statusCode).toBe(200);
    expect(d.getShoppingList).toHaveBeenLastCalledWith("default", "current");
    expect((await list("POST /meals/plans/{weekStart}/shopping-list/refresh")).statusCode).toBe(200);
    expect(d.refreshShoppingList).toHaveBeenLastCalledWith(TEST_IDENTITY, "current", undefined);
    expect((await list("POST /meals/plans/{weekStart}/shopping-list/refresh", { range: "WEEK" })).statusCode).toBe(200);
    expect(d.refreshShoppingList).toHaveBeenLastCalledWith(TEST_IDENTITY, "current", "WEEK");
    const operations = [
      { type: "check", key: "milk", checked: true },
      { type: "add", key: "manual-abc-1", name: " Klopapier " },
      { type: "move", key: "milk", afterKey: null },
      { type: "remove", key: "manual-abc-1" },
    ];
    expect((await list("POST /meals/plans/{weekStart}/shopping-list/changes", { operations })).statusCode).toBe(200);
    expect(d.changeShoppingList).toHaveBeenLastCalledWith(TEST_IDENTITY, "current", [
      { type: "check", key: "milk", checked: true },
      { type: "add", key: "manual-abc-1", name: "Klopapier" },
      { type: "move", key: "milk", afterKey: null },
      { type: "remove", key: "manual-abc-1" },
    ]);
    expect((await list("POST /meals/plans/{weekStart}/shopping-list/changes", { operations: [] })).statusCode).toBe(400);
    expect((await list("POST /meals/plans/{weekStart}/shopping-list/changes", { operations: [{ type: "add", key: "milk", name: "x" }] })).statusCode).toBe(400);
    expect((await list("POST /meals/plans/{weekStart}/shopping-list/refresh", { range: "MONTH" })).statusCode).toBe(400);
  });
});

describe("PUT /tenners/{tennerId}", () => {
  const put = (id: string | undefined, payload: unknown): APIGatewayProxyEventV2 =>
    ({
      routeKey: "PUT /tenners/{tennerId}",
      headers: {},
      body: JSON.stringify(payload),
      pathParameters: id === undefined ? undefined : { tennerId: id },
      requestContext: { requestId: "req-1" },
    }) as unknown as APIGatewayProxyEventV2;

  it("updates and returns 200", async () => {
    const d = deps();
    const response = await route(put("t-1", { frequencyDays: 30 }), d);
    expect(response.statusCode).toBe(200);
    expect(d.updateTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", { frequencyDays: 30, frequencyUnit: "DAY", frequencyInterval: 30, weekdays: null });
  });

  it("returns 404 when the Tenner does not exist", async () => {
    const d = deps({ updateTenner: vi.fn().mockRejectedValue(new NotFoundError("Tenner not found.")) });
    const response = await route(put("missing", { title: "Vacuum Home Office" }), d);
    expect(response.statusCode).toBe(404);
    expect(body(response).error).toEqual({ code: "NOT_FOUND", message: "Tenner not found." });
  });

  it.each([
    ["protected field nextDue", "t-1", { nextDue: "2026-12-01" }],
    ["protected field tenantId", "t-1", { tenantId: "other" }],
    ["empty body object", "t-1", {}],
    ["invalid id", "bad id!", { title: "Valid title" }],
    ["missing id", undefined, { title: "Valid title" }],
  ])("rejects %s with 400", async (_name, id, payload) => {
    const d = deps();
    const response = await route(put(id, payload), d);
    expect(response.statusCode).toBe(400);
    expect(d.updateTenner).not.toHaveBeenCalled();
  });
});

describe("DELETE /tenners/{tennerId}", () => {
  const del = (id: string): APIGatewayProxyEventV2 =>
    ({ routeKey: "DELETE /tenners/{tennerId}", headers: {}, pathParameters: { tennerId: id }, requestContext: { requestId: "req-1" } }) as unknown as APIGatewayProxyEventV2;

  it("soft deletes and returns 200 { tennerId, deleted: true }", async () => {
    const d = deps();
    const response = await route(del("t-1"), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: { tennerId: "t-1", deleted: true } });
    expect(d.deleteTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1");
  });

  it("returns 404 for missing Tenners", async () => {
    const d = deps({ deleteTenner: vi.fn().mockRejectedValue(new NotFoundError("Tenner not found.")) });
    expect((await route(del("missing"), d)).statusCode).toBe(404);
  });

  it("rejects invalid ids", async () => {
    const d = deps();
    expect((await route(del("../etc"), d)).statusCode).toBe(400);
    expect(d.deleteTenner).not.toHaveBeenCalled();
  });
});

describe("POST /tenners/{tennerId}/complete", () => {
  const complete = (payload: unknown, headers: Record<string, string> = {}): APIGatewayProxyEventV2 =>
    ({
      routeKey: "POST /tenners/{tennerId}/complete",
      headers,
      body: JSON.stringify(payload),
      pathParameters: { tennerId: "t-1" },
      requestContext: { requestId: "req-1" },
    }) as unknown as APIGatewayProxyEventV2;

  it("completes and passes the idempotency key", async () => {
    const d = deps();
    const response = await route(complete({ completedBy: "STEFAN", actualMinutes: 12 }, { "idempotency-key": "abc-1" }), d);
    expect(response.statusCode).toBe(200);
    expect(d.completeTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", { completedBy: "STEFAN", actualMinutes: 12 }, "abc-1");
  });

  it.each([
    ["TENNER_INACTIVE", new ConflictError("Inactive Tenners cannot be completed.", "TENNER_INACTIVE"), 409],
    ["CONCURRENT_MODIFICATION", new ConflictError("The Tenner was modified by another request.", "CONCURRENT_MODIFICATION"), 409],
    ["NOT_FOUND", new NotFoundError("Tenner not found."), 404],
  ])("maps %s", async (code, error, status) => {
    const d = deps({ completeTenner: vi.fn().mockRejectedValue(error) });
    const response = await route(complete({ completedBy: "STEFAN" }), d);
    expect(response.statusCode).toBe(status);
    expect(body(response).error?.code).toBe(code);
  });

  it("rejects an invalid idempotency key", async () => {
    const d = deps();
    expect((await route(complete({ completedBy: "STEFAN" }, { "idempotency-key": "has space" }), d)).statusCode).toBe(400);
    expect(d.completeTenner).not.toHaveBeenCalled();
  });
});

describe("POST /tenners/{tennerId}/undo-completion", () => {
  const undo = (payload: unknown, headers: Record<string, string> = {}): APIGatewayProxyEventV2 =>
    ({
      routeKey: "POST /tenners/{tennerId}/undo-completion",
      headers,
      body: JSON.stringify(payload),
      pathParameters: { tennerId: "t-1" },
      requestContext: { requestId: "req-1" },
    }) as unknown as APIGatewayProxyEventV2;

  it("undoes and passes the trimmed reason and idempotency key", async () => {
    const d = deps();
    const response = await route(undo({ revertedBy: "JULIA", reason: "  Completed by mistake " }, { "idempotency-key": "u-1" }), d);
    expect(response.statusCode).toBe(200);
    expect(d.undoCompletion).toHaveBeenCalledWith(TEST_IDENTITY, "t-1", { revertedBy: "JULIA", reason: "Completed by mistake" }, "u-1");
  });

  it("maps NO_COMPLETION_TO_UNDO to 409", async () => {
    const d = deps({ undoCompletion: vi.fn().mockRejectedValue(new ConflictError("No active completion is available to undo.", "NO_COMPLETION_TO_UNDO")) });
    const response = await route(undo({ revertedBy: "STEFAN" }), d);
    expect(response.statusCode).toBe(409);
    expect(body(response).error).toEqual({ code: "NO_COMPLETION_TO_UNDO", message: "No active completion is available to undo." });
  });
});

describe("POST /tenners/{tennerId}/restore", () => {
  const restore = (payload: unknown): APIGatewayProxyEventV2 =>
    ({ routeKey: "POST /tenners/{tennerId}/restore", headers: {}, body: JSON.stringify(payload), pathParameters: { tennerId: "t-1" }, requestContext: { requestId: "req-1" } }) as unknown as APIGatewayProxyEventV2;

  it("restores and returns { tennerId, active, deletedAt }", async () => {
    const d = deps();
    const response = await route(restore({ restoredBy: "STEFAN" }), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: { tennerId: "t-1", active: true, deletedAt: null } });
    expect(d.restoreTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1");
  });

  it("defaults restoredBy to the authenticated user", async () => {
    const d = deps();
    expect((await route(restore({}), d)).statusCode).toBe(200);
    expect(d.restoreTenner).toHaveBeenCalledWith(TEST_IDENTITY, "t-1");
  });

  it("rejects restoredBy of another user with 403 (audit fields cannot be spoofed)", async () => {
    const d = deps();
    const response = await route(restore({ restoredBy: "JULIA" }), d);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body ?? "").error.code).toBe("FORBIDDEN");
    expect(d.restoreTenner).not.toHaveBeenCalled();
  });
});

describe("GET /dashboard", () => {
  it("routes with parsed filters and returns the standard contract", async () => {
    const d = deps();
    const response = await route(event("GET /dashboard", {}, undefined, { assignedTo: "STEFAN", category: "HOUSEHOLD", date: "2026-10-01" }), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: emptyDashboard });
    expect(d.getDashboard).toHaveBeenCalledWith("default", { assignedTo: "STEFAN", category: "HOUSEHOLD", date: "2026-10-01" });
  });

  it.each([{ assignedTo: "bob" }, { category: "garden" }, { date: "01.10.2026" }, { date: "2026-02-30" }])("rejects %j with 400 Invalid dashboard query.", async (query) => {
    const d = deps();
    const response = await route(event("GET /dashboard", {}, undefined, query), d);
    expect(response.statusCode).toBe(400);
    expect(body(response).error).toMatchObject({ code: "VALIDATION_ERROR", message: "Invalid dashboard query." });
    expect(d.getDashboard).not.toHaveBeenCalled();
  });
});

describe("GET /tenners/{tennerId}", () => {
  const get = (id: string, query?: Record<string, string>): APIGatewayProxyEventV2 =>
    ({ routeKey: "GET /tenners/{tennerId}", headers: {}, pathParameters: { tennerId: id }, queryStringParameters: query, requestContext: { requestId: "req-1" } }) as unknown as APIGatewayProxyEventV2;

  it("returns the Tenner", async () => {
    const d = deps();
    const response = await route(get("t-1"), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: tennerResponse });
    expect(d.getTenner).toHaveBeenCalledWith("default", "t-1", { includeDeleted: undefined });
  });

  it("passes includeDeleted and validates input", async () => {
    const d = deps();
    await route(get("t-1", { includeDeleted: "true" }), d);
    expect(d.getTenner).toHaveBeenCalledWith("default", "t-1", { includeDeleted: true });
    expect((await route(get("bad id"), d)).statusCode).toBe(400);
    expect((await route(get("t-1", { includeDeleted: "yes" }), d)).statusCode).toBe(400);
  });
});

describe("history routes", () => {
  it("GET /history parses filters", async () => {
    const d = deps();
    const response = await route(event("GET /history", {}, undefined, { from: "2026-09-01", to: "2026-09-30", completedBy: "JULIA", limit: "50", includeUndone: "true" }), d);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "")).toEqual({ success: true, data: { items: [], nextCursor: null } });
    expect(d.getHistory).toHaveBeenCalledWith("default", { from: "2026-09-01", to: "2026-09-30", completedBy: "JULIA", limit: 50, includeUndone: true });
  });

  it.each([{ limit: "0" }, { limit: "101" }, { limit: "ten" }, { from: "2026-10-02", to: "2026-10-01" }, { cursor: "not base64!" }, { completedBy: "bob" }, { foo: "1" }])("GET /history rejects %j", async (query) => {
    const d = deps();
    expect((await route(event("GET /history", {}, undefined, query), d)).statusCode).toBe(400);
    expect(d.getHistory).not.toHaveBeenCalled();
  });

  it("GET /tenners/{tennerId}/history passes id and paging", async () => {
    const d = deps();
    const ev = { routeKey: "GET /tenners/{tennerId}/history", headers: {}, pathParameters: { tennerId: "t-1" }, queryStringParameters: { limit: "5" }, requestContext: { requestId: "r" } } as unknown as APIGatewayProxyEventV2;
    expect((await route(ev, d)).statusCode).toBe(200);
    expect(d.getTennerHistory).toHaveBeenCalledWith("default", "t-1", { limit: 5 });
  });
});

describe("correlationIdOf", () => {
  it("falls back to the request id for missing or unsafe headers", () => {
    expect(correlationIdOf(event("GET /health"))).toBe("req-1");
    expect(correlationIdOf(event("GET /health", { "x-correlation-id": "bad value\n" }))).toBe("req-1");
  });

  it("uses 'unknown' when no request id exists", () => {
    expect(correlationIdOf({ routeKey: "GET /health" } as unknown as APIGatewayProxyEventV2)).toBe("unknown");
  });
});

describe("createDependencies", () => {
  it("logs the startup configuration without secrets", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    createDependencies(testConfig());
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toEqual({
      level: "INFO",
      message: "Tenner API starting",
      environment: "prod",
      application: "Tenner",
      timezone: "Europe/Berlin",
      tables: { tenners: "tenner-tenners", history: "tenner-history", households: "tenner-households" },
      onboarding: { userPoolId: "eu-central-1_TEST", tenantId: "default" },
      alexa: "not configured",
      meals: "tenner-meals",
    });
  });
});

describe("handler", () => {
  it("reports misconfigured when table variables are missing (no AWS call)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await handler(event("GET /health"));
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body ?? "").database).toBe("misconfigured");
  });
});

describe("household routes (SCHEDULING-008)", () => {
  it("GET /household uses the tenant from the claims; PUT passes the identity", async () => {
    const d = deps();
    const get = await route({ routeKey: "GET /household", headers: {}, requestContext: { requestId: "r" } } as unknown as APIGatewayProxyEventV2, d);
    expect(get.statusCode).toBe(200);
    expect(d.getHousehold).toHaveBeenCalledWith("default");
    const put = await route({ routeKey: "PUT /household", headers: {}, body: JSON.stringify({ timezone: "Europe/Vienna" }), requestContext: { requestId: "r" } } as unknown as APIGatewayProxyEventV2, d);
    expect(put.statusCode).toBe(200);
    expect(d.updateHousehold).toHaveBeenCalledWith(TEST_IDENTITY, { timezone: "Europe/Vienna" });
  });

  it("rejects an unknown timezone with 400", async () => {
    const d = deps();
    const put = await route({ routeKey: "PUT /household", headers: {}, body: JSON.stringify({ timezone: "Mars/Olympus" }), requestContext: { requestId: "r" } } as unknown as APIGatewayProxyEventV2, d);
    expect(put.statusCode).toBe(400);
    expect(d.updateHousehold).not.toHaveBeenCalled();
  });
});

describe("analytics routes (ANALYTICS-001)", () => {
  it("validates the period query and returns the summary", async () => {
    const d = deps();
    const ok = await route(event("GET /analytics/summary", {}, undefined, { period: "last90" }), d);
    expect(ok.statusCode).toBe(200);
    expect(d.analyticsSummary).toHaveBeenCalledWith("default", { period: "last90" });
    expect((await route(event("GET /analytics/summary", {}, undefined, { period: "decade" }), d)).statusCode).toBe(400);
    expect((await route(event("GET /analytics/summary", {}, undefined, { from: "1.10.2026" }), d)).statusCode).toBe(400);
    expect((await route(event("GET /analytics/summary", {}, undefined, { foo: "x" }), d)).statusCode).toBe(400);
  });

  it("validates trends filters (ANALYTICS-002)", async () => {
    const d = deps();
    const query = { granularity: "month", assignedTo: "JULIA", category: "HOME" };
    expect((await route(event("GET /analytics/trends", {}, undefined, query), d)).statusCode).toBe(200);
    expect(d.analyticsTrends).toHaveBeenCalledWith("default", query);
    expect((await route(event("GET /analytics/trends", {}, undefined, { granularity: "hour" }), d)).statusCode).toBe(400);
    expect((await route(event("GET /analytics/trends", {}, undefined, { assignedTo: "bob" }), d)).statusCode).toBe(400);
  });

  it("serves user metrics with the period query (ANALYTICS-003)", async () => {
    const d = deps();
    expect((await route(event("GET /analytics/users", {}, undefined, { period: "month" }), d)).statusCode).toBe(200);
    expect(d.analyticsUsers).toHaveBeenCalledWith("default", { period: "month" });
    expect((await route(event("GET /analytics/users", {}, undefined, { granularity: "day" }), d)).statusCode).toBe(400);
  });

  it("serves category metrics (ANALYTICS-004)", async () => {
    const d = deps();
    expect((await route(event("GET /analytics/categories", {}, undefined, { period: "year" }), d)).statusCode).toBe(200);
    expect(d.analyticsCategories).toHaveBeenCalledWith("default", { period: "year" });
  });

  it("serves the household balance (ANALYTICS-007)", async () => {
    const d = deps();
    expect((await route(event("GET /analytics/balance", {}, undefined, { period: "quarter" }), d)).statusCode).toBe(200);
    expect(d.analyticsBalance).toHaveBeenCalledWith("default", { period: "quarter" });
  });

  it("serves habits and validates the Tenner ID (ANALYTICS-008)", async () => {
    const d = deps();
    expect((await route(event("GET /analytics/habits", {}, undefined, { period: "last90" }), d)).statusCode).toBe(200);
    const detail = { ...event("GET /analytics/habits/{tennerId}", {}, undefined, { period: "month" }), pathParameters: { tennerId: "5c2bfd9b-c8d1-4ab7-af57-b1dfe6ddbf05" } } as APIGatewayProxyEventV2;
    expect((await route(detail, d)).statusCode).toBe(200);
    expect(d.analyticsHabit).toHaveBeenCalledWith("default", "5c2bfd9b-c8d1-4ab7-af57-b1dfe6ddbf05", { period: "month" });
    const bad = { ...event("GET /analytics/habits/{tennerId}"), pathParameters: { tennerId: "../x" } } as APIGatewayProxyEventV2;
    expect((await route(bad, d)).statusCode).toBe(400);
  });

  it("serves time investment (ANALYTICS-005)", async () => {
    const d = deps();
    expect((await route(event("GET /analytics/time", {}, undefined, { period: "last30" }), d)).statusCode).toBe(200);
    expect(d.analyticsTime).toHaveBeenCalledWith("default", { period: "last30" });
  });

  it("validates the neglected limit (ANALYTICS-006)", async () => {
    const d = deps();
    expect((await route(event("GET /analytics/neglected", {}, undefined, { limit: "5" }), d)).statusCode).toBe(200);
    expect(d.analyticsNeglected).toHaveBeenCalledWith("default", { limit: 5 });
    for (const limit of ["0", "51", "x", "1.5"]) {
      expect((await route(event("GET /analytics/neglected", {}, undefined, { limit }), d)).statusCode).toBe(400);
    }
  });
});
