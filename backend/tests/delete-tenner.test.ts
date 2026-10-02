import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError, PersistenceError } from "../src/exceptions/index.js";
import { deleteTennerHandler } from "../src/handlers/delete-tenner.js";
import { DeleteTennerService } from "../src/services/index.js";
import { mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-01T18:00:00.250Z");
const TS = "2026-10-01T18:00:00Z";

describe("DeleteTennerService", () => {
  it("soft deletes with the current timestamp (active flag and deletedAt via repository)", async () => {
    const repository = mockTennerRepository();
    const deleted = tennerFixture({ active: false, deletedAt: TS, updatedAt: TS });
    repository.delete.mockResolvedValue({ status: "DELETED", tenner: deleted });
    const result = await new DeleteTennerService(repository, () => NOW).deleteTenner(TEST_IDENTITY, "t-1");

    expect(repository.delete).toHaveBeenCalledWith("default", "t-1", TS, "STEFAN");
    expect(result.response).toEqual({ tennerId: "t-1", deleted: true });
    expect(result.outcome.tenner).toMatchObject({ active: false, deletedAt: TS });
  });

  it("succeeds idempotently for already deleted Tenners", async () => {
    const repository = mockTennerRepository();
    repository.delete.mockResolvedValue({ status: "ALREADY_DELETED", tenner: tennerFixture({ active: false, deletedAt: "2026-09-01T00:00:00Z" }) });
    const result = await new DeleteTennerService(repository, () => NOW).deleteTenner(TEST_IDENTITY, "t-1");
    expect(result.response).toEqual({ tennerId: "t-1", deleted: true });
  });

  it("propagates missing Tenners and repository failures", async () => {
    const repository = mockTennerRepository();
    const service = new DeleteTennerService(repository, () => NOW);
    repository.delete.mockRejectedValueOnce(new NotFoundError("Tenner not found."));
    await expect(service.deleteTenner(TEST_IDENTITY, "x")).rejects.toBeInstanceOf(NotFoundError);
    repository.delete.mockRejectedValueOnce(new PersistenceError());
    await expect(service.deleteTenner(TEST_IDENTITY, "x")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("deleteTennerHandler", () => {
  const event = { pathParameters: { tennerId: "t-1" } } as unknown as APIGatewayProxyEventV2;

  it.each([
    ["DELETED", "Tenner deleted"],
    ["ALREADY_DELETED", "Tenner already deleted"],
  ] as const)("logs %s with category and assigned user", async (status, message) => {
    const logger = mockLogger();
    const del = vi.fn().mockResolvedValue({ response: { tennerId: "t-1", deleted: true }, outcome: { status, tenner: tennerFixture() } });
    const response = await deleteTennerHandler(event, TEST_IDENTITY, del, logger);
    expect(response.statusCode).toBe(200);
    expect(logger.info).toHaveBeenCalledWith(message, { tennerId: "t-1", category: "HOUSEHOLD", assignedTo: "STEFAN" });
  });
});
