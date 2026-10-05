/** HOUSEHOLD-001: rotating assignment. */

import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/exceptions/index.js";
import { toTenner } from "../src/repositories/dynamodb/tenner.mapper.js";
import { toCompletion, toCompletionItem } from "../src/repositories/dynamodb/completion.mapper.js";
import { SEED_MEMBERS, type HouseholdMember } from "../src/models/index.js";
import { CompleteTennerService, CreateTennerService, UndoCompletionService } from "../src/services/index.js";
import { nextInRotation } from "../src/utils/rotation.js";
import { createTennerSchema, updateTennerSchema, validate } from "../src/validators/index.js";
import { completionFixture, mockCompletionRepository, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-05T08:00:00Z");
const LENA: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true, createdAt: "t", updatedAt: "t" };
const members = [...SEED_MEMBERS, LENA];
const all = () => true;

describe("nextInRotation", () => {
  it("advances and wraps around", () => {
    expect(nextInRotation(["STEFAN", "JULIA", "LENA"], "STEFAN", all)).toBe("JULIA");
    expect(nextInRotation(["STEFAN", "JULIA", "LENA"], "LENA", all)).toBe("STEFAN");
  });

  it("skips deactivated members and keeps the assignee when nobody else is active", () => {
    expect(nextInRotation(["STEFAN", "JULIA", "LENA"], "STEFAN", (id) => id !== "JULIA")).toBe("LENA");
    expect(nextInRotation(["STEFAN", "JULIA"], "STEFAN", (id) => id === "STEFAN")).toBe("STEFAN");
  });

  it("starts with the first active member when the assignee is not in the rotation", () => {
    expect(nextInRotation(["JULIA", "LENA"], "STEFAN", all)).toBe("JULIA");
  });
});

describe("completion and undo of rotating Tenners", () => {
  const rotating = tennerFixture({ tennerId: "t-1", assignedTo: "STEFAN", assignmentMode: "ROTATING", rotation: ["STEFAN", "JULIA"] });

  function complete(tenner = rotating, memberList: readonly HouseholdMember[] = members) {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(tenner);
    tenners.completeTenner.mockResolvedValue(undefined);
    const service = new CompleteTennerService(tenners, mockCompletionRepository(), () => NOW, () => "c-1", async () => "UTC", async () => null, async () => memberList);
    return { tenners, service };
  }

  it("rotates to the next member and remembers the previous assignee", async () => {
    const { tenners, service } = complete();
    const outcome = await service.completeTenner(TEST_IDENTITY, "t-1", {});
    const [updated, record] = tenners.completeTenner.mock.calls[0] ?? [];
    expect(updated?.assignedTo).toBe("JULIA");
    expect(record?.completion.assignedToBefore).toBe("STEFAN");
    expect(outcome.response.tenner.assignedTo).toBe("JULIA");
  });

  it("advances by the assigned member, not by who covered", async () => {
    const { tenners, service } = complete();
    await service.completeTenner({ tenantId: "default", userId: "JULIA" }, "t-1", {});
    expect(tenners.completeTenner.mock.calls[0]?.[0].assignedTo).toBe("JULIA");
    expect(tenners.completeTenner.mock.calls[0]?.[1].completion.completedBy).toBe("JULIA");
  });

  it("skips deactivated members and leaves fixed Tenners alone", async () => {
    const three = { ...rotating, rotation: ["STEFAN", "JULIA", "LENA"] };
    const { tenners, service } = complete(three, [SEED_MEMBERS[0] as HouseholdMember, { ...(SEED_MEMBERS[1] as HouseholdMember), active: false }, LENA]);
    await service.completeTenner(TEST_IDENTITY, "t-1", {});
    expect(tenners.completeTenner.mock.calls[0]?.[0].assignedTo).toBe("LENA");
    const fixed = complete(tennerFixture({ assignedTo: "STEFAN" }));
    await fixed.service.completeTenner(TEST_IDENTITY, "t-1", {});
    expect(fixed.tenners.completeTenner.mock.calls[0]?.[0].assignedTo).toBe("STEFAN");
    expect(fixed.tenners.completeTenner.mock.calls[0]?.[1].completion.assignedToBefore).toBeUndefined();
  });

  it("undo restores the previous assignee", async () => {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue({ ...rotating, assignedTo: "JULIA", lastCompleted: "2026-10-05T08:00:00Z" });
    tenners.undoCompletion.mockResolvedValue(undefined);
    const history = mockCompletionRepository();
    history.getLatestActiveCompletions.mockResolvedValue([completionFixture({ tennerId: "t-1", completedAt: "2026-10-05T08:00:00Z", assignedToBefore: "STEFAN" })]);
    history.findByRevertIdempotencyKey.mockResolvedValue(undefined);
    await new UndoCompletionService(tenners, history, () => NOW, async () => "UTC").undoLatestCompletion(TEST_IDENTITY, "t-1", {});
    expect(tenners.undoCompletion.mock.calls[0]?.[0].assignedTo).toBe("STEFAN");
  });

  it("stores and reads assignedToBefore on completion records", () => {
    const item = toCompletionItem({ completion: completionFixture({ assignedToBefore: "STEFAN" }) });
    expect(item.assignedToBefore).toBe("STEFAN");
    expect(toCompletion(item).assignedToBefore).toBe("STEFAN");
    expect(toCompletionItem({ completion: completionFixture() })).not.toHaveProperty("assignedToBefore");
  });
});

describe("rotation validation and storage", () => {
  const base = { title: "Bad putzen", category: "HOUSEHOLD", estimatedMinutes: 30, frequencyDays: 7 };
  const fields = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return (error as ValidationError).details?.map((d) => d.field);
    }
    throw new Error("expected a validation error");
  };

  it("normalizes create requests (FIXED by default)", () => {
    expect(validate(createTennerSchema, { ...base, assignedTo: "STEFAN" })).toMatchObject({ assignmentMode: "FIXED", rotation: null });
    expect(validate(createTennerSchema, { ...base, assignedTo: "STEFAN", assignmentMode: "ROTATING", rotation: ["STEFAN", "JULIA"] })).toMatchObject({
      assignmentMode: "ROTATING",
      rotation: ["STEFAN", "JULIA"],
    });
  });

  it("needs at least two distinct members including the assignee", () => {
    expect(fields(() => validate(createTennerSchema, { ...base, assignedTo: "STEFAN", assignmentMode: "ROTATING", rotation: ["STEFAN"] }))).toEqual(["rotation"]);
    expect(fields(() => validate(createTennerSchema, { ...base, assignedTo: "STEFAN", assignmentMode: "ROTATING", rotation: ["STEFAN", "STEFAN"] }))).toEqual(["rotation"]);
    expect(fields(() => validate(createTennerSchema, { ...base, assignedTo: "STEFAN", assignmentMode: "ROTATING", rotation: ["STEFAN", "HOUSEHOLD"] }))).toEqual(["rotation"]);
    expect(fields(() => validate(createTennerSchema, { ...base, assignedTo: "LENA", assignmentMode: "ROTATING", rotation: ["STEFAN", "JULIA"] }))).toEqual(["assignedTo"]);
    expect(fields(() => validate(createTennerSchema, { ...base, assignedTo: "STEFAN", rotation: ["STEFAN", "JULIA"] }))).toEqual(["rotation"]);
  });

  it("normalizes updates: FIXED clears the rotation, unrelated updates leave it", () => {
    expect(validate(updateTennerSchema, { assignmentMode: "FIXED" })).toEqual({ assignmentMode: "FIXED", rotation: null });
    expect(validate(updateTennerSchema, { title: "Neu" })).toEqual({ title: "Neu" });
    expect(fields(() => validate(updateTennerSchema, { assignmentMode: "ROTATING" }))).toEqual(["rotation"]);
  });

  it("rejects unknown or inactive rotation members", async () => {
    const service = new CreateTennerService(mockTennerRepository(), () => NOW, () => "t-1", async () => "UTC", async () => members);
    const request = { ...base, frequencyUnit: "DAY", frequencyInterval: 7, weekdays: null, assignedTo: "STEFAN", assignmentMode: "ROTATING", rotation: ["STEFAN", "BOB"] } as const;
    await expect(service.createTenner(TEST_IDENTITY, request)).rejects.toMatchObject({ details: [{ field: "rotation" }] });
    await expect(service.createTenner(TEST_IDENTITY, { ...request, rotation: ["STEFAN", "LENA"] })).resolves.toMatchObject({ assignmentMode: "ROTATING", rotation: ["STEFAN", "LENA"] });
  });

  it("reads stored rotations and falls back to FIXED for invalid data", () => {
    const item = { tenantId: "default", tennerId: "t", title: "x", category: "HOME", estimatedMinutes: 5, frequencyDays: 7, assignedTo: "STEFAN", nextDue: "2026-10-05", active: true };
    expect(toTenner({ ...item, assignmentMode: "ROTATING", rotation: ["STEFAN", "JULIA"] })).toMatchObject({ assignmentMode: "ROTATING", rotation: ["STEFAN", "JULIA"] });
    expect(toTenner({ ...item, assignmentMode: "ROTATING", rotation: ["STEFAN"] })).toMatchObject({ assignmentMode: "FIXED", rotation: null });
    expect(toTenner(item)).toMatchObject({ assignmentMode: "FIXED", rotation: null });
  });
});
