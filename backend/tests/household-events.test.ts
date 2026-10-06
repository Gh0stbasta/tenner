/** ALEXA-007: household change events from the API. */

import type { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { changesHousehold, createHouseholdChangePublisher } from "../src/events/household-events.js";
import { createDependencies, route } from "../src/index.js";
import { authenticatedEvent, mockLogger, testConfig } from "./mocks/index.js";

describe("household change publisher", () => {
  it("puts one HouseholdChanged event with tenant and route", async () => {
    const send = vi.fn<(command: PutEventsCommand) => Promise<unknown>>(async () => ({ FailedEntryCount: 0 }));
    await createHouseholdChangePublisher({ send }, "default")("default", "POST /tenners/{tennerId}/complete", mockLogger());
    expect(send.mock.calls[0]?.[0].input.Entries).toEqual([
      { Source: "tenner.api", DetailType: "HouseholdChanged", EventBusName: "default", Detail: JSON.stringify({ tenantId: "default", routeKey: "POST /tenners/{tennerId}/complete" }) },
    ]);
  });

  it("logs failures instead of throwing", async () => {
    const logger = mockLogger();
    await createHouseholdChangePublisher({ send: async () => Promise.reject(Object.assign(new Error("x"), { name: "TimeoutError" })) }, "default")("default", "POST /tenners", logger);
    await createHouseholdChangePublisher({ send: async () => ({ FailedEntryCount: 1, Entries: [{ ErrorCode: "AccessDenied" }] }) }, "default")("default", "POST /tenners", logger);
    expect(logger.warn).toHaveBeenNthCalledWith(1, "Household change event not published", { event: "HouseholdEventFailed", error: "TimeoutError" });
    expect(logger.warn).toHaveBeenNthCalledWith(2, "Household change event rejected", { event: "HouseholdEventFailed", errorCode: "AccessDenied" });
  });

  it("treats successful writes only as changes", () => {
    expect(changesHousehold("POST /tenners/{tennerId}/complete", 201)).toBe(true);
    expect(changesHousehold("GET /dashboard", 200)).toBe(false);
    expect(changesHousehold("PUT /tenners/{tennerId}", 409)).toBe(false);
  });
});

describe("route publishes after writes", () => {
  const event = (routeKey: string, body?: string) =>
    authenticatedEvent({ routeKey, rawPath: "/", headers: {}, requestContext: { requestId: "r" }, pathParameters: { userId: "STEFAN" }, ...(body ? { body } : {}) } as unknown as Partial<APIGatewayProxyEventV2>);

  it("publishes for a successful write and not for reads", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const deps = createDependencies(testConfig({ householdEventsBus: "default" }));
    const publish = vi.fn(async () => undefined);
    const withPublisher = { ...deps, publishHouseholdChange: publish, getNotificationPreferences: vi.fn(async () => ({}) as never), updateNotificationPreferences: vi.fn(async () => ({}) as never) };
    expect(deps.publishHouseholdChange).toBeTypeOf("function");
    await route(event("GET /users/{userId}/notification-preferences"), withPublisher);
    expect(publish).not.toHaveBeenCalled();
    const body = JSON.stringify({
      timezone: null,
      dailyDigest: { enabled: true, time: "07:30", channels: [] },
      overdueAlerts: { enabled: true, minDaysOverdue: 2, channels: [] },
      weeklySummary: { enabled: false, dayOfWeek: "SUN", time: "18:00", channels: [] },
      quietHours: null,
    });
    expect((await route(event("PUT /users/{userId}/notification-preferences", body), withPublisher)).statusCode).toBe(200);
    expect(publish).toHaveBeenCalledWith("default", "PUT /users/{userId}/notification-preferences", expect.anything());
    vi.restoreAllMocks();
  });

  it("has no publisher without HOUSEHOLD_EVENTS_BUS", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(createDependencies(testConfig()).publishHouseholdChange).toBeUndefined();
    vi.restoreAllMocks();
  });
});
