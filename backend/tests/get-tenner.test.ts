import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError, PersistenceError } from "../src/exceptions/index.js";
import { getTennerHandler } from "../src/handlers/get-tenner.js";
import { GetTennerService } from "../src/services/index.js";
import { mockLogger, mockTennerRepository, tennerFixture } from "./mocks/index.js";

function setup(tenner = tennerFixture()) {
  const repository = mockTennerRepository();
  repository.getById.mockResolvedValue(tenner);
  return { repository, service: new GetTennerService(repository) };
}

describe("GetTennerService", () => {
  it("returns an existing Tenner without tenantId", async () => {
    const { repository, service } = setup();
    const result = await service.getTenner("default", "t-1");
    expect(repository.getById).toHaveBeenCalledWith("default", "t-1");
    expect(result).toMatchObject({ tennerId: tennerFixture().tennerId, title: "Vacuum Office" });
    expect(result).not.toHaveProperty("tenantId");
  });

  it("returns 404 for missing Tenners", async () => {
    const { repository, service } = setup();
    repository.getById.mockResolvedValue(undefined);
    await expect(service.getTenner("default", "x")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides soft-deleted Tenners unless includeDeleted is set", async () => {
    const { service } = setup(tennerFixture({ active: false, deletedAt: "2026-10-01T18:00:00Z" }));
    await expect(service.getTenner("default", "t-1")).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getTenner("default", "t-1", { includeDeleted: false })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getTenner("default", "t-1", { includeDeleted: true })).resolves.toMatchObject({ deletedAt: "2026-10-01T18:00:00Z" });
  });

  it("returns inactive (but not deleted) Tenners", async () => {
    const { service } = setup(tennerFixture({ active: false }));
    await expect(service.getTenner("default", "t-1")).resolves.toMatchObject({ active: false });
  });

  it("propagates repository failures", async () => {
    const { repository, service } = setup();
    repository.getById.mockRejectedValue(new PersistenceError());
    await expect(service.getTenner("default", "t-1")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("getTennerHandler", () => {
  it("logs the read", async () => {
    const logger = mockLogger();
    const event = { pathParameters: { tennerId: "t-1" } } as unknown as APIGatewayProxyEventV2;
    const response = await getTennerHandler(event, "default", vi.fn().mockResolvedValue({ tennerId: "t-1" }), logger);
    expect(response.statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith("Tenner read", { tennerId: "t-1", includeDeleted: false });
  });
});
