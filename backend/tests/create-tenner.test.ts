import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { createTennerHandler } from "../src/handlers/create-tenner.js";
import { CreateTennerService } from "../src/services/index.js";
import { mockLogger, mockTennerRepository } from "./mocks/index.js";

const NOW = new Date("2026-10-01T18:30:15.123Z");
const ID = "5c2bfd9b-c8d1-4ab7-af57-b1dfe6ddbf05";
const request = { title: "Vacuum Office", category: "HOUSEHOLD", estimatedMinutes: 10, frequencyDays: 14, assignedTo: "STEFAN" } as const;

function service() {
  const repository = mockTennerRepository();
  return { repository, service: new CreateTennerService(repository, () => NOW, () => ID) };
}

describe("CreateTennerService", () => {
  it("creates a Tenner with generated fields and defaults", async () => {
    const { repository, service: svc } = service();
    const response = await svc.createTenner("default", request);

    expect(repository.save).toHaveBeenCalledWith({
      tenantId: "default",
      tennerId: ID,
      ...request,
      lastCompleted: null,
      nextDue: "2026-10-01",
      active: true,
      createdAt: "2026-10-01T18:30:15Z",
      updatedAt: "2026-10-01T18:30:15Z",
    });
    expect(response).toEqual({
      tennerId: ID,
      ...request,
      lastCompleted: null,
      nextDue: "2026-10-01",
      active: true,
      createdAt: "2026-10-01T18:30:15Z",
      updatedAt: "2026-10-01T18:30:15Z",
    });
  });

  it("uses the UTC date for nextDue just before midnight UTC", async () => {
    const repository = mockTennerRepository();
    const svc = new CreateTennerService(repository, () => new Date("2026-10-01T23:59:59Z"), () => ID);
    expect((await svc.createTenner("default", request)).nextDue).toBe("2026-10-01");
  });

  it("propagates repository failures", async () => {
    const { repository, service: svc } = service();
    repository.save.mockRejectedValue(new PersistenceError("Failed to save Tenner."));
    await expect(svc.createTenner("default", request)).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("createTennerHandler", () => {
  const event = (body: unknown): APIGatewayProxyEventV2 =>
    ({ body: typeof body === "string" ? body : JSON.stringify(body), isBase64Encoded: false }) as unknown as APIGatewayProxyEventV2;

  it("returns 201 with the created Tenner and logs the creation", async () => {
    const logger = mockLogger();
    const { service: svc } = service();
    const response = await createTennerHandler(event(request), "default", (t, r) => svc.createTenner(t, r), logger);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body ?? "").data).toMatchObject({ tennerId: ID, title: "Vacuum Office" });
    expect(logger.info).toHaveBeenCalledWith("Tenner created", { tennerId: ID, assignedTo: "STEFAN", category: "HOUSEHOLD" });
  });

  it.each([
    ["invalid title", { ...request, title: "ab" }],
    ["invalid frequency days", { ...request, frequencyDays: 4000 }],
    ["invalid category", { ...request, category: "GARDEN" }],
    ["invalid assigned user", { ...request, assignedTo: "BOB" }],
    ["malformed JSON", "{"],
    ["missing body", ""],
  ])("rejects %s", async (_name, body) => {
    const create = vi.fn();
    await expect(createTennerHandler(event(body), "default", create, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(create).not.toHaveBeenCalled();
  });

  it("propagates repository failures (mapped to 500 by the router)", async () => {
    const create = vi.fn().mockRejectedValue(new PersistenceError());
    await expect(createTennerHandler(event(request), "default", create, mockLogger())).rejects.toBeInstanceOf(PersistenceError);
  });

  it("propagates conflicts", async () => {
    const create = vi.fn().mockRejectedValue(new ConflictError("Tenner already exists."));
    await expect(createTennerHandler(event(request), "default", create, mockLogger())).rejects.toBeInstanceOf(ConflictError);
  });
});
