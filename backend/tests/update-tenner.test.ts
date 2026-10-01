import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { updateTennerHandler } from "../src/handlers/update-tenner.js";
import { UpdateTennerService } from "../src/services/index.js";
import { mockLogger, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const NOW = new Date("2026-10-05T12:00:00.500Z");

function setup() {
  const repository = mockTennerRepository();
  repository.update.mockImplementation(async (_t, _id, changes) => ({ ...tennerFixture(), ...JSON.parse(JSON.stringify(changes)) }));
  return { repository, service: new UpdateTennerService(repository, () => NOW) };
}

describe("UpdateTennerService", () => {
  it("updates a single field and refreshes updatedAt", async () => {
    const { repository, service } = setup();
    const result = await service.updateTenner("default", "t-1", { frequencyDays: 30 });

    expect(repository.update).toHaveBeenCalledWith("default", "t-1", {
      title: undefined,
      category: undefined,
      estimatedMinutes: undefined,
      frequencyDays: 30,
      assignedTo: undefined,
      active: undefined,
      updatedAt: "2026-10-05T12:00:00Z",
    });
    expect(result.frequencyDays).toBe(30);
    expect(result.updatedAt).toBe("2026-10-05T12:00:00Z");
  });

  it("updates multiple fields", async () => {
    const { repository, service } = setup();
    await service.updateTenner("default", "t-1", { title: "Vacuum Home Office", estimatedMinutes: 15, assignedTo: "JULIA" });
    expect(repository.update.mock.calls[0]?.[2]).toMatchObject({ title: "Vacuum Home Office", estimatedMinutes: 15, assignedTo: "JULIA" });
  });

  it("deactivates a Tenner", async () => {
    const { service } = setup();
    expect((await service.updateTenner("default", "t-1", { active: false })).active).toBe(false);
  });

  it("never passes schedule or identity fields to the repository", async () => {
    const { repository, service } = setup();
    const sneaky = { frequencyDays: 7, nextDue: "2030-01-01", lastCompleted: "x", tenantId: "other", createdAt: "x" } as never;
    const result = await service.updateTenner("default", "t-1", sneaky);
    const changes = repository.update.mock.calls[0]?.[2] ?? {};
    expect(Object.keys(changes)).not.toEqual(expect.arrayContaining(["nextDue"]));
    for (const key of ["nextDue", "lastCompleted", "tenantId", "createdAt", "tennerId"]) expect(changes).not.toHaveProperty(key);
    expect(result.nextDue).toBe(tennerFixture().nextDue);
  });

  it("propagates NotFoundError and repository failures", async () => {
    const repository = mockTennerRepository();
    const service = new UpdateTennerService(repository, () => NOW);
    repository.update.mockRejectedValueOnce(new NotFoundError("Tenner not found."));
    await expect(service.updateTenner("default", "x", { title: "abc" })).rejects.toBeInstanceOf(NotFoundError);
    repository.update.mockRejectedValueOnce(new PersistenceError());
    await expect(service.updateTenner("default", "x", { title: "abc" })).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("updateTennerHandler", () => {
  const event = (payload: unknown, tennerId = "t-1"): APIGatewayProxyEventV2 =>
    ({ body: JSON.stringify(payload), pathParameters: { tennerId } }) as unknown as APIGatewayProxyEventV2;

  it("returns 200 and logs changed fields", async () => {
    const logger = mockLogger();
    const { service } = setup();
    const response = await updateTennerHandler(event({ title: "Vacuum Home Office", frequencyDays: 30 }), "default", (t, id, r) => service.updateTenner(t, id, r), logger);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? "").data).toMatchObject({ title: "Vacuum Home Office", frequencyDays: 30 });
    expect(logger.info).toHaveBeenCalledWith("Tenner updated", { tennerId: "t-1", changedFields: ["title", "frequencyDays"], assignedTo: "STEFAN" });
  });

  it.each([
    ["invalid category", { category: "GARDEN" }],
    ["invalid assigned user", { assignedTo: "BOB" }],
    ["invalid duration", { estimatedMinutes: 481 }],
    ["invalid active flag", { active: "no" }],
    ["protected lastCompleted", { lastCompleted: "2026-10-01T00:00:00Z" }],
  ])("rejects %s", async (_name, payload) => {
    const update = vi.fn();
    await expect(updateTennerHandler(event(payload), "default", update, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(update).not.toHaveBeenCalled();
  });
});
