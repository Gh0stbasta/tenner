import { describe, expect, it } from "vitest";
import { mockCompletionRepository, mockTennerRepository, mockTennerService, tennerFixture } from "./mocks/index.js";

describe("test mocks", () => {
  it("provide typed repository and service doubles", async () => {
    const repository = mockTennerRepository();
    repository.getById.mockResolvedValue(tennerFixture());
    await expect(repository.getById("default", "t1")).resolves.toMatchObject({ title: "Vacuum Office" });

    const completions = mockCompletionRepository();
    completions.getHistory.mockResolvedValue({ items: [] });
    await expect(completions.getHistory("default", { limit: 20 })).resolves.toEqual({ items: [] });

    const service = mockTennerService();
    service.listDueTenners.mockResolvedValue([]);
    await expect(service.listDueTenners("default", "2026-10-01")).resolves.toEqual([]);
  });
});
