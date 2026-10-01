/** Shared test doubles: configuration, logger, repository and service mocks. */

import { vi, type Mocked } from "vitest";
import type { AppConfig } from "../../src/config.js";
import type { Tenner } from "../../src/models/index.js";
import type { CompletionRepository, TennerRepository } from "../../src/repositories/index.js";
import type { AnalyticsService, TennerService } from "../../src/services/index.js";
import type { Logger } from "../../src/utils/logger.js";

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    environment: "prod",
    tenantId: "default",
    logLevel: "INFO",
    applicationName: "Tenner",
    tables: { tenners: "tenner-tenners", history: "tenner-history" },
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
  return { getById: vi.fn(), list: vi.fn(), save: vi.fn(), update: vi.fn(), delete: vi.fn(), completeTenner: vi.fn() };
}

export function mockCompletionRepository(): Mocked<CompletionRepository> {
  return { getById: vi.fn(), create: vi.fn(), getHistory: vi.fn(), getByTenner: vi.fn() };
}

export function mockTennerService(): Mocked<TennerService> {
  return { createTenner: vi.fn(), updateTenner: vi.fn(), completeTenner: vi.fn(), listDueTenners: vi.fn() };
}

export function mockAnalyticsService(): Mocked<AnalyticsService> {
  return { getDashboard: vi.fn(), getCompletionMetrics: vi.fn() };
}

export function tennerFixture(overrides: Partial<Tenner> = {}): Tenner {
  return {
    tenantId: "default",
    tennerId: "5c2bfd9b-c8d1-4ab7-af57-b1dfe6ddbf05",
    title: "Vacuum Office",
    category: "HOUSEHOLD",
    estimatedMinutes: 10,
    frequencyDays: 14,
    assignedTo: "STEFAN",
    lastCompleted: null,
    nextDue: "2026-10-01",
    active: true,
    deletedAt: null,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}
