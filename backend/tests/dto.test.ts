import { describe, expect, it } from "vitest";
import { toCompletionResponse, toTennerResponse } from "../src/dto/index.js";
import { CATEGORIES, HOUSEHOLD_USERS, USER_IDS } from "../src/models/index.js";
import { tennerFixture } from "./mocks/index.js";

describe("dto mappers", () => {
  it("maps a Tenner without exposing tenantId", () => {
    const response = toTennerResponse(tennerFixture());
    expect(response).not.toHaveProperty("tenantId");
    expect(response).toMatchObject({ tennerId: "5c2bfd9b-c8d1-4ab7-af57-b1dfe6ddbf05", title: "Vacuum Office", lastCompleted: null });
  });

  it("maps a Completion without exposing tenantId", () => {
    const response = toCompletionResponse({
      tenantId: "default",
      completionId: "c1",
      tennerId: "t1",
      completedBy: "JULIA",
      completedAt: "2026-10-01T18:30:00Z",
      actualMinutes: 12,
      revertedAt: null,
      revertedBy: null,
      revertReason: null,
    });
    expect(response).toEqual({ completionId: "c1", tennerId: "t1", completedBy: "JULIA", completedAt: "2026-10-01T18:30:00Z", actualMinutes: 12 });
  });
});

describe("domain enumerations", () => {
  it("define the initial categories and users", () => {
    expect(CATEGORIES).toEqual(["HOUSEHOLD", "FITNESS", "FAMILY", "HOME", "PERSONAL", "FINANCE"]);
    expect(USER_IDS).toEqual(["STEFAN", "JULIA"]);
    expect(HOUSEHOLD_USERS.map((u) => u.userId)).toEqual([...USER_IDS]);
  });
});
