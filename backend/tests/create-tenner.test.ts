import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { createTennerHandler } from "../src/handlers/create-tenner.js";
import { CreateTennerService } from "../src/services/index.js";
import { mockLogger, mockTennerRepository, TEST_IDENTITY, testIdentity } from "./mocks/index.js";

const NOW = new Date("2026-10-01T18:30:15.123Z");
const ID = "5c2bfd9b-c8d1-4ab7-af57-b1dfe6ddbf05";
/** Validated (normalized) request as the service receives it. */
const request = { title: "Vacuum Office", category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14, frequencyUnit: "DAY", frequencyInterval: 14, weekdays: null, assignedTo: "STEFAN" } as const;

function service() {
  const repository = mockTennerRepository();
  return { repository, service: new CreateTennerService(repository, () => NOW, () => ID, async () => "UTC") };
}

describe("CreateTennerService", () => {
  it("creates a Tenner with generated fields and defaults", async () => {
    const { repository, service: svc } = service();
    const response = await svc.createTenner(TEST_IDENTITY, request);

    expect(repository.save).toHaveBeenCalledWith({
      tenantId: "default",
      tennerId: ID,
      ...request,
      lastCompleted: null,
      nextDue: "2026-10-01",
      snoozedUntil: null,
      active: true,
      deletedAt: null,
      createdAt: "2026-10-01T18:30:15Z",
      updatedAt: "2026-10-01T18:30:15Z",
      createdBy: "STEFAN",
      updatedBy: "STEFAN",
    });
    expect(response).toEqual({
      tennerId: ID,
      ...request,
      lastCompleted: null,
      nextDue: "2026-10-01",
      snoozedUntil: null,
      active: true,
      deletedAt: null,
      createdAt: "2026-10-01T18:30:15Z",
      updatedAt: "2026-10-01T18:30:15Z",
      createdBy: "STEFAN",
      updatedBy: "STEFAN",
    });
  });

  it("takes tenant and audit user from the identity (SECURITY-004)", async () => {
    const { repository, service: svc } = service();
    await svc.createTenner(testIdentity({ tenantId: "household-2", userId: "JULIA" }), request);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "household-2", createdBy: "JULIA", updatedBy: "JULIA" }));
  });

  it("uses today in the household timezone for nextDue (SCHEDULING-008)", async () => {
    const repository = mockTennerRepository();
    const late = () => new Date("2026-10-01T23:59:59Z");
    expect((await new CreateTennerService(repository, late, () => ID, async () => "UTC").createTenner(TEST_IDENTITY, request)).nextDue).toBe("2026-10-01");
    const timezoneOf = vi.fn(async () => "Europe/Berlin");
    const svc = new CreateTennerService(repository, late, () => ID, timezoneOf);
    expect((await svc.createTenner(TEST_IDENTITY, request)).nextDue).toBe("2026-10-02");
    expect(timezoneOf).toHaveBeenCalledWith("default");
  });

  it("propagates repository failures", async () => {
    const { repository, service: svc } = service();
    repository.save.mockRejectedValue(new PersistenceError("Failed to save Tenner."));
    await expect(svc.createTenner(TEST_IDENTITY, request)).rejects.toBeInstanceOf(PersistenceError);
  });
});

/** Request body as clients sent it before SCHEDULING-001 (frequencyDays only). */
const body = { title: "Vacuum Office", category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14, assignedTo: "STEFAN" } as const;

describe("createTennerHandler", () => {
  const event = (body: unknown): APIGatewayProxyEventV2 =>
    ({ body: typeof body === "string" ? body : JSON.stringify(body), isBase64Encoded: false }) as unknown as APIGatewayProxyEventV2;

  it("returns 201 with the created Tenner and logs the creation", async () => {
    const logger = mockLogger();
    const { service: svc } = service();
    const response = await createTennerHandler(event(body), TEST_IDENTITY, (t, r) => svc.createTenner(t, r), logger);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? "").data).toMatchObject({ tennerId: ID, title: "Vacuum Office" });
    expect(logger.info).toHaveBeenCalledWith("Tenner created", { tennerId: ID, createdBy: "STEFAN", assignedTo: "STEFAN", category: "HOUSEHOLD" });
  });

  it.each([
    ["invalid title", { ...body, title: "ab" }],
    ["invalid frequency days", { ...body, frequencyDays: 4000 }],
    ["invalid category", { ...body, category: "GARDEN" }],
    ["invalid assigned user", { ...body, assignedTo: "BOB" }],
    ["malformed JSON", "{"],
    ["missing body", ""],
  ])("rejects %s", async (_name, body) => {
    const create = vi.fn();
    await expect(createTennerHandler(event(body), TEST_IDENTITY, create, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(create).not.toHaveBeenCalled();
  });

  it("propagates repository failures (mapped to 500 by the router)", async () => {
    const create = vi.fn().mockRejectedValue(new PersistenceError());
    await expect(createTennerHandler(event(body), TEST_IDENTITY, create, mockLogger())).rejects.toBeInstanceOf(PersistenceError);
  });

  it("propagates conflicts", async () => {
    const create = vi.fn().mockRejectedValue(new ConflictError("Tenner already exists."));
    await expect(createTennerHandler(event(body), TEST_IDENTITY, create, mockLogger())).rejects.toBeInstanceOf(ConflictError);
  });
});
