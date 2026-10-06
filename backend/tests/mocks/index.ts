/** Shared test doubles: configuration, logger, repository and service mocks. */

import { vi, type Mocked } from "vitest";
import type { Identity } from "../../src/auth/index.js";
import type { AppConfig } from "../../src/config.js";
import type { Completion, HouseholdSettings, Tenner } from "../../src/models/index.js";
import type { CompletionRepository, TennerRepository } from "../../src/repositories/index.js";
import type { TennerService } from "../../src/services/index.js";
import type { ApiEvent } from "../../src/types/api.js";
import type { Logger } from "../../src/utils/logger.js";

/** Identity of the default test user (tenant "default", user STEFAN). */
export const TEST_IDENTITY: Identity = { tenantId: "default", userId: "STEFAN" };

export function testIdentity(overrides: Partial<Identity> = {}): Identity {
  return { ...TEST_IDENTITY, ...overrides };
}

/**
 * JWT claims as API Gateway's JWT authorizer passes them: the household group of a Google user (FUTURE-011).
 * HTTP API flattens the cognito:groups array into one string "[a b]".
 */
export function jwtClaims(identity: Identity = TEST_IDENTITY): Record<string, string> {
  return {
    sub: "11111111-2222-3333-4444-555555555555",
    "cognito:username": "google_123456789",
    "cognito:groups": `[household:${identity.tenantId}:${identity.userId}]`,
  };
}

/**
 * Authenticated API event (SECURITY-004): `event` with the verified claims set like the JWT authorizer does.
 * `claims` replaces the default claims entirely; pass `null` for an event without an authorizer context.
 */
export function authenticatedEvent(event: Partial<ApiEvent>, claims: Record<string, string> | null = jwtClaims()): ApiEvent {
  const requestContext = { requestId: "req-1", ...(event.requestContext ?? {}) } as ApiEvent["requestContext"];
  return {
    ...event,
    requestContext: claims === null ? requestContext : ({ ...requestContext, authorizer: { jwt: { claims, scopes: null } } } as ApiEvent["requestContext"]),
  } as ApiEvent;
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    environment: "prod",
    logLevel: "INFO",
    applicationName: "Tenner",
    timezone: "Europe/Berlin",
    tables: { tenners: "tenner-tenners", history: "tenner-history", households: "tenner-households" },
    onboarding: { userPoolId: "eu-central-1_TEST", tenantId: "default" },
    alexaClientId: undefined,
    notificationsTable: undefined,
    householdTenantId: "default",
    appUrl: undefined,
    householdEventsBus: undefined,
    alexaApi: undefined,
    ...overrides,
  };
}

export function mockLogger(): Mocked<Logger> {
  const logger: Mocked<Logger> = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

export function mockTennerRepository(): Mocked<TennerRepository> {
  return { getById: vi.fn(), getTitles: vi.fn(), getDashboardCandidates: vi.fn(), list: vi.fn(), save: vi.fn(), update: vi.fn(), delete: vi.fn(), completeTenner: vi.fn(), undoCompletion: vi.fn(), snoozeTenner: vi.fn(), skipTenner: vi.fn(), updateSchedule: vi.fn(), restore: vi.fn() };
}

export function mockCompletionRepository(): Mocked<CompletionRepository> {
  return { getById: vi.fn(), getLatestActiveCompletions: vi.fn(), findByRevertIdempotencyKey: vi.fn(), getHistory: vi.fn(), getByTenner: vi.fn(), listCompletions: vi.fn(), listSkips: vi.fn() };
}

export function mockTennerService(): Mocked<TennerService> {
  return { createTenner: vi.fn(), updateTenner: vi.fn(), completeTenner: vi.fn(), listDueTenners: vi.fn() };
}


export function completionFixture(overrides: Partial<Completion> = {}): Completion {
  return {
    tenantId: "default",
    completionId: "completion-002",
    tennerId: "tenner-001",
    completedBy: "STEFAN",
    recordedBy: "STEFAN",
    completedAt: "2026-10-01T18:30:00Z",
    actualMinutes: 12,
    revertedAt: null,
    revertedBy: null,
    revertReason: null,
    ...overrides,
  };
}

export function tennerFixture(overrides: Partial<Tenner> = {}): Tenner {
  return {
    tenantId: "default",
    tennerId: "5c2bfd9b-c8d1-4ab7-af57-b1dfe6ddbf05",
    title: "Vacuum Office",
    category: "HOUSEHOLD",
    estimatedMinutes: 10,
    frequencyDays: 14,
    frequencyUnit: "DAY",
    frequencyInterval: 14,
    weekdays: null,
    assignedTo: "STEFAN",
    assignmentMode: "FIXED",
    rotation: null,
    originalAssignee: null,
    lastCompleted: null,
    nextDue: "2026-10-01",
    snoozedUntil: null,
    pausedAt: null,
    pausedUntil: null,
    active: true,
    deletedAt: null,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    createdBy: "STEFAN",
    updatedBy: "STEFAN",
    ...overrides,
  };
}

/** A stored household item with nothing customized (HOUSEHOLD-ADMIN-001 – 003). */
export function householdSettings(overrides: Partial<HouseholdSettings> = {}): HouseholdSettings {
  return {
    tenantId: "default",
    name: null,
    timezone: null,
    weekStartsOn: null,
    workdays: null,
    defaults: null,
    vacation: null,
    members: null,
    membersVersion: 0,
    categories: null,
    handovers: [],
    handoversVersion: 0,
    alexaSpeakers: [],
    alexaSpeakersVersion: 0,
    alexaUsers: [],
    alexaUsersVersion: 0,
    notificationPreferences: {},
    notificationPreferencesVersion: 0,
    categoriesVersion: 0,
    updatedAt: "t",
    updatedBy: null,
    ...overrides,
  };
}
