import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { restoreTennerHandler } from "../src/handlers/restore-tenner.js";
import { RestoreTennerService } from "../src/services/index.js";
import { mockLogger, mockTennerRepository, tennerFixture } from "./mocks/index.js";

const NOW = new Date("2026-10-02T09:00:00.100Z");
const TS = "2026-10-02T09:00:00Z";
const deleted = tennerFixture({
  tennerId: "t-1",
  active: false,
  deletedAt: "2026-10-01T18:00:00Z",
  lastCompleted: "2026-09-01T18:00:00Z",
  nextDue: "2026-09-15",
  updatedAt: "2026-10-01T18:00:00Z",
});
const restored = { ...deleted, active: true, deletedAt: null, updatedAt: TS };

function setup(tenner = deleted) {
  const repository = mockTennerRepository();
  repository.getById.mockResolvedValue(tenner);
  repository.restore.mockResolvedValue(restored);
  return { repository, service: new RestoreTennerService(repository, () => NOW) };
}

describe("RestoreTennerService", () => {
  it("restores a deleted Tenner with optimistic locking on updatedAt", async () => {
    const { repository, service } = setup();
    const outcome = await service.restoreTenner("default", "t-1");
    expect(repository.restore).toHaveBeenCalledWith("default", "t-1", "2026-10-01T18:00:00Z", TS);
    expect(outcome).toEqual({ response: { tennerId: "t-1", active: true, deletedAt: null }, status: "RESTORED", previousDeletedAt: "2026-10-01T18:00:00Z" });
  });

  it("returns success without changes for an already active Tenner", async () => {
    const { repository, service } = setup(restored);
    await expect(service.restoreTenner("default", "t-1")).resolves.toMatchObject({ status: "ALREADY_ACTIVE", response: { active: true, deletedAt: null } });
    expect(repository.restore).not.toHaveBeenCalled();
  });

  it("returns 404 for missing Tenners", async () => {
    const { repository, service } = setup();
    repository.getById.mockResolvedValue(undefined);
    await expect(service.restoreTenner("default", "x")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects inactive Tenners that were not deleted with TENNER_NOT_DELETED", async () => {
    const { repository, service } = setup(tennerFixture({ active: false, deletedAt: null }));
    await expect(service.restoreTenner("default", "t-1")).rejects.toMatchObject({ code: "TENNER_NOT_DELETED", statusCode: 409 });
    expect(repository.restore).not.toHaveBeenCalled();
  });

  it("treats a parallel successful restore as success (idempotent)", async () => {
    const { repository, service } = setup();
    repository.restore.mockRejectedValue(new ConflictError("m", "CONCURRENT_MODIFICATION"));
    repository.getById.mockResolvedValueOnce(deleted).mockResolvedValueOnce(restored);
    await expect(service.restoreTenner("default", "t-1")).resolves.toMatchObject({ status: "ALREADY_ACTIVE" });
  });

  it.each([
    ["changed but still deleted", deleted],
    ["gone", undefined],
  ])("returns CONCURRENT_MODIFICATION when the Tenner was modified (%s)", async (_name, current) => {
    const { repository, service } = setup();
    repository.restore.mockRejectedValue(new ConflictError("The Tenner was modified by another request.", "CONCURRENT_MODIFICATION"));
    repository.getById.mockResolvedValueOnce(deleted).mockResolvedValueOnce(current);
    await expect(service.restoreTenner("default", "t-1")).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION", statusCode: 409 });
  });

  it("propagates repository failures", async () => {
    const { repository, service } = setup();
    repository.restore.mockRejectedValue(new PersistenceError());
    await expect(service.restoreTenner("default", "t-1")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("restoreTennerHandler", () => {
  const event = (payload: unknown): APIGatewayProxyEventV2 => ({ body: JSON.stringify(payload), pathParameters: { tennerId: "t-1" } }) as unknown as APIGatewayProxyEventV2;

  it.each([
    ["RESTORED", "Tenner restored"],
    ["ALREADY_ACTIVE", "Tenner already active"],
  ] as const)("logs %s with restoredBy and the previous deletion timestamp", async (status, message) => {
    const logger = mockLogger();
    const restore = vi.fn().mockResolvedValue({ response: { tennerId: "t-1", active: true, deletedAt: null }, status, previousDeletedAt: "2026-10-01T18:00:00Z" });
    const response = await restoreTennerHandler(event({ restoredBy: "STEFAN" }), "default", restore, logger);
    expect(response.statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith(message, { tennerId: "t-1", restoredBy: "STEFAN", previousDeletedAt: "2026-10-01T18:00:00Z" });
  });

  it.each([{ restoredBy: "BOB" }, {}, { restoredBy: "STEFAN", active: true }])("rejects %j", async (payload) => {
    const restore = vi.fn();
    await expect(restoreTennerHandler(event(payload), "default", restore, mockLogger())).rejects.toBeInstanceOf(ValidationError);
    expect(restore).not.toHaveBeenCalled();
  });
});
