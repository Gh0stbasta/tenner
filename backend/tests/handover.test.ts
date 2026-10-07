/** HOUSEHOLD-004: temporary handover. */

import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, PersistenceError, ValidationError } from "../src/exceptions/index.js";
import { SEED_MEMBERS, type Handover, type HouseholdMember, type HouseholdSettings, type Tenner } from "../src/models/index.js";
import { DynamoDbHouseholdRepository, type TennerCriteria, type TennerUpdate } from "../src/repositories/index.js";
import type { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { toTenner } from "../src/repositories/dynamodb/tenner.mapper.js";
import { CompleteTennerService, HandoverService, UndoCompletionService, UpdateTennerService } from "../src/services/index.js";
import { completionFixture, householdSettings, mockCompletionRepository, mockLogger, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

const TODAY = "2026-10-05";
const NOW = new Date(`${TODAY}T08:00:00Z`);
const LENA: HouseholdMember = { userId: "LENA", displayName: "Lena", color: "GREEN", active: true, canSignIn: true, createdAt: "t", updatedAt: "t" };
const MEMBERS = [...SEED_MEMBERS, LENA];

/** In-memory household item and Tenner table. */
function world(tenners: readonly Tenner[], settings: Partial<HouseholdSettings> = {}) {
  let household: HouseholdSettings = householdSettings({ members: MEMBERS, membersVersion: 1, ...settings });
  const table = new Map(tenners.map((tenner) => [tenner.tennerId, tenner]));
  const households = {
    get: vi.fn(async () => household),
    saveHandovers: vi.fn(async (_tenantId: string, handovers: readonly Handover[], expectedVersion: number) => {
      if (expectedVersion !== household.handoversVersion) throw new ConflictError("changed", "CONCURRENT_MODIFICATION");
      household = { ...household, handovers, handoversVersion: expectedVersion + 1 };
      return household;
    }),
  };
  const repository = {
    list: vi.fn(async (_tenantId: string, criteria: TennerCriteria = {}) =>
      [...table.values()].filter((tenner) => tenner.deletedAt === null && (criteria.assignedTo === undefined || tenner.assignedTo === criteria.assignedTo)),
    ),
    update: vi.fn(async (_tenantId: string, tennerId: string, changes: TennerUpdate) => {
      const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
      const updated = { ...(table.get(tennerId) as Tenner), ...defined } as Tenner;
      table.set(tennerId, updated);
      return updated;
    }),
  };
  const logger = mockLogger();
  const clock = { now: NOW };
  const service = new HandoverService(households, repository, () => clock.now, async () => "UTC", logger);
  return { service, households, repository, logger, clock, tenner: (id: string) => table.get(id) as Tenner, household: () => household };
}

const tenner = (id: string, overrides: Partial<Tenner> = {}) => tennerFixture({ tennerId: id, assignedTo: "STEFAN", ...overrides });

describe("HandoverService.start", () => {
  it("hands the member's Tenners over and remembers the original assignee (Handover Applies)", async () => {
    const w = world([tenner("a"), tenner("b", { category: "HOME" }), tenner("c", { assignedTo: "JULIA" })]);
    const result = await w.service.start(TEST_IDENTITY, "STEFAN", { to: "JULIA", until: "2026-10-12" });
    expect(result).toEqual({ handover: { from: "STEFAN", to: "JULIA", until: "2026-10-12", categories: null }, handedOver: 2 });
    expect(w.tenner("a")).toMatchObject({ assignedTo: "JULIA", originalAssignee: "STEFAN", updatedBy: "STEFAN" });
    expect(w.tenner("b")).toMatchObject({ assignedTo: "JULIA", originalAssignee: "STEFAN" });
    expect(w.tenner("c")).toMatchObject({ assignedTo: "JULIA", originalAssignee: null });
    expect(w.household().handovers).toEqual([{ from: "STEFAN", to: "JULIA", until: "2026-10-12", categories: null, createdAt: "2026-10-05T08:00:00Z", createdBy: "STEFAN" }]);
  });

  it("moves only Tenners of the listed categories (Category Filter)", async () => {
    const w = world([tenner("a"), tenner("b", { category: "HOME" })], { categories: null });
    const result = await w.service.start(TEST_IDENTITY, "STEFAN", { to: "JULIA", until: TODAY, categories: ["HOME"] });
    expect(result.handedOver).toBe(1);
    expect(w.tenner("a").assignedTo).toBe("STEFAN");
    expect(w.tenner("b")).toMatchObject({ assignedTo: "JULIA", originalAssignee: "STEFAN" });
  });

  it("passes on Tenners the member covers for someone else, keeping their owner", async () => {
    const w = world([tenner("a", { originalAssignee: "LENA" })]);
    await w.service.start(TEST_IDENTITY, "STEFAN", { to: "JULIA", until: "2026-10-12" });
    expect(w.tenner("a")).toMatchObject({ assignedTo: "JULIA", originalAssignee: "LENA" });
  });

  it("rejects invalid handovers", async () => {
    const w = world([], { members: [...MEMBERS, { ...LENA, userId: "OLD", active: false }], handovers: [{ from: "LENA", to: "STEFAN", until: TODAY, categories: null, createdAt: "t", createdBy: "LENA" }] });
    const start = (from: string, to: string, until = "2026-10-12", categories?: string[]) => w.service.start(TEST_IDENTITY, from, { to, until, categories });
    await expect(start("NOBODY", "JULIA")).rejects.toBeInstanceOf(NotFoundError);
    await expect(start("OLD", "JULIA")).rejects.toMatchObject({ code: "MEMBER_INACTIVE" });
    await expect(start("STEFAN", "STEFAN")).rejects.toBeInstanceOf(ValidationError);
    await expect(start("STEFAN", "OLD")).rejects.toBeInstanceOf(ValidationError);
    await expect(start("STEFAN", "NOBODY")).rejects.toBeInstanceOf(ValidationError);
    await expect(start("STEFAN", "LENA")).rejects.toMatchObject({ details: [{ field: "to", message: "This member has handed over their own Tenners." }] });
    await expect(start("STEFAN", "JULIA", "2026-10-04")).rejects.toMatchObject({ details: [{ field: "until" }] });
    await expect(start("STEFAN", "JULIA", "2026-10-12", ["NOPE"])).rejects.toMatchObject({ details: [{ field: "categories" }] });
    expect(w.households.saveHandovers).not.toHaveBeenCalled();
  });

  it("allows one running handover per member; the identical request finishes an interrupted one", async () => {
    const w = world([tenner("a"), tenner("b")]);
    w.repository.update.mockRejectedValueOnce(new PersistenceError("boom"));
    await expect(w.service.start(TEST_IDENTITY, "STEFAN", { to: "JULIA", until: "2026-10-12" })).rejects.toBeInstanceOf(PersistenceError);
    await expect(w.service.start(TEST_IDENTITY, "STEFAN", { to: "LENA", until: "2026-10-12" })).rejects.toMatchObject({ code: "HANDOVER_ACTIVE" });
    const retry = await w.service.start(TEST_IDENTITY, "STEFAN", { to: "JULIA", until: "2026-10-12" });
    expect(retry.handedOver).toBe(2);
    expect(w.households.saveHandovers).toHaveBeenCalledOnce();
    expect([w.tenner("a").assignedTo, w.tenner("b").assignedTo]).toEqual(["JULIA", "JULIA"]);
  });

  it("replaces an expired handover of the member after giving its Tenners back", async () => {
    const old: Handover = { from: "STEFAN", to: "LENA", until: "2026-10-01", categories: null, createdAt: "t", createdBy: "STEFAN" };
    const w = world([tenner("a", { assignedTo: "LENA", originalAssignee: "STEFAN" })], { handovers: [old], handoversVersion: 1 });
    const result = await w.service.start(TEST_IDENTITY, "STEFAN", { to: "JULIA", until: "2026-10-12" });
    expect(result.handedOver).toBe(1);
    expect(w.tenner("a")).toMatchObject({ assignedTo: "JULIA", originalAssignee: "STEFAN" });
    expect(w.household().handovers.map((handover) => handover.to)).toEqual(["JULIA"]);
  });
});

describe("HandoverService.end (Manual Revert)", () => {
  it("gives the Tenners back and removes the handover", async () => {
    const w = world([tenner("a"), tenner("b", { assignedTo: "JULIA" })]);
    await w.service.start(TEST_IDENTITY, "STEFAN", { to: "JULIA", until: "2026-10-12" });
    await expect(w.service.end({ tenantId: "default", userId: "JULIA" }, "STEFAN")).resolves.toEqual({ returned: 1 });
    expect(w.tenner("a")).toMatchObject({ assignedTo: "STEFAN", originalAssignee: null, updatedBy: "JULIA" });
    expect(w.tenner("b")).toMatchObject({ assignedTo: "JULIA", originalAssignee: null });
    expect(w.household().handovers).toEqual([]);
  });

  it("404 without a handover", async () => {
    await expect(world([]).service.end(TEST_IDENTITY, "STEFAN")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("leaves Tenners with the cover when the member was deactivated meanwhile", async () => {
    const w = world([tenner("a", { assignedTo: "JULIA", originalAssignee: "LENA" })], {
      members: [...SEED_MEMBERS, { ...LENA, active: false }],
      handovers: [{ from: "LENA", to: "JULIA", until: "2026-10-12", categories: null, createdAt: "t", createdBy: "LENA" }],
      handoversVersion: 1,
    });
    await w.service.end(TEST_IDENTITY, "LENA");
    expect(w.tenner("a")).toMatchObject({ assignedTo: "JULIA", originalAssignee: null });
  });
});

describe("HandoverService.expireDue (Automatic Revert)", () => {
  it("gives back handovers whose last day has passed, keeps running ones", async () => {
    const w = world([tenner("a"), tenner("b", { assignedTo: "LENA" })]);
    await w.service.start(TEST_IDENTITY, "STEFAN", { to: "JULIA", until: TODAY });
    await w.service.start(TEST_IDENTITY, "LENA", { to: "JULIA", until: "2026-10-12" });

    await w.service.expireDue("default");
    expect(w.tenner("a").assignedTo).toBe("JULIA"); // until is inclusive
    w.clock.now = new Date("2026-10-06T08:00:00Z");
    await w.service.expireDue("default");
    expect(w.tenner("a")).toMatchObject({ assignedTo: "STEFAN", originalAssignee: null, updatedBy: "STEFAN" });
    expect(w.tenner("b")).toMatchObject({ assignedTo: "JULIA", originalAssignee: "LENA" });
    expect(w.household().handovers.map((handover) => handover.from)).toEqual(["LENA"]);
    expect(w.logger.info).toHaveBeenCalledWith("Handover ended", { event: "HandoverExpired", from: "STEFAN", to: "JULIA", until: TODAY, returned: 1 });
  });

  it("costs one read without handovers and never fails the read", async () => {
    const w = world([tenner("a")]);
    await w.service.expireDue("default");
    expect(w.households.get).toHaveBeenCalledOnce();
    expect(w.repository.list).not.toHaveBeenCalled();
    w.households.get.mockRejectedValueOnce(new PersistenceError("down"));
    await expect(w.service.expireDue("default")).resolves.toBeUndefined();
    expect(w.logger.warn).toHaveBeenCalledWith("Handover expiry skipped", expect.objectContaining({ errorCode: "UNEXPECTED" }));
  });

  it("a concurrent expiry is logged, not raised", async () => {
    const old: Handover = { from: "STEFAN", to: "JULIA", until: "2026-10-01", categories: null, createdAt: "t", createdBy: "STEFAN" };
    const w = world([], { handovers: [old], handoversVersion: 1 });
    w.households.saveHandovers.mockRejectedValueOnce(new ConflictError("changed", "CONCURRENT_MODIFICATION"));
    await expect(w.service.expireDue("default")).resolves.toBeUndefined();
    expect(w.logger.warn).toHaveBeenCalledWith("Handover expiry skipped", expect.objectContaining({ errorCode: "CONCURRENT_MODIFICATION" }));
  });
});

describe("handover and other writes", () => {
  it("a manual reassignment clears originalAssignee (Manual Reassignment During Handover)", async () => {
    const repository = mockTennerRepository();
    repository.update.mockResolvedValue(tennerFixture());
    const service = new UpdateTennerService(repository, () => NOW);
    await service.updateTenner(TEST_IDENTITY, "t-1", { assignedTo: "STEFAN" });
    expect(repository.update.mock.calls[0]?.[2]).toMatchObject({ assignedTo: "STEFAN", originalAssignee: null });
    await service.updateTenner(TEST_IDENTITY, "t-1", { title: "Neu" });
    expect(repository.update.mock.calls[1]?.[2].originalAssignee).toBeUndefined();
  });

  it("reads originalAssignee from stored items", () => {
    const item = { ...tennerFixture(), originalAssignee: "STEFAN" };
    expect(toTenner(item).originalAssignee).toBe("STEFAN");
    expect(toTenner({ ...item, originalAssignee: undefined }).originalAssignee).toBeNull();
    expect(toTenner({ ...item, originalAssignee: "bad id" }).originalAssignee).toBeNull();
  });
});

describe("rotating Tenners during a handover (Rotating Tenners Interaction)", () => {
  const rotation = ["STEFAN", "JULIA", "LENA"];
  const handover = (from: string, to: string, until = "2026-10-12"): Handover => ({ from, to, until, categories: null, createdAt: "t", createdBy: from });

  function complete(tenner: Tenner, handovers: readonly Handover[]) {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(tenner);
    tenners.completeTenner.mockResolvedValue(undefined);
    const service = new CompleteTennerService(tenners, mockCompletionRepository(), () => NOW, () => "c-1", async () => "UTC", async () => null, async () => MEMBERS, async () => handovers);
    return { tenners, service };
  }

  it("advances from the original assignee's turn and ends the cover for this Tenner", async () => {
    const covered = tennerFixture({ assignmentMode: "ROTATING", rotation, assignedTo: "JULIA", originalAssignee: "STEFAN" });
    const { tenners, service } = complete(covered, [handover("STEFAN", "JULIA")]);
    await service.completeTenner({ tenantId: "default", userId: "JULIA" }, "t-1", {});
    const [updated, record] = tenners.completeTenner.mock.calls[0] ?? [];
    expect(updated).toMatchObject({ assignedTo: "JULIA", originalAssignee: null });
    expect(record?.completion).toMatchObject({ assignedToBefore: "JULIA", originalAssigneeBefore: "STEFAN" });
  });

  it("hands the next turn to the cover when the next member is away", async () => {
    const { tenners, service } = complete(tennerFixture({ assignmentMode: "ROTATING", rotation, assignedTo: "STEFAN" }), [handover("JULIA", "LENA")]);
    await service.completeTenner(TEST_IDENTITY, "t-1", {});
    expect(tenners.completeTenner.mock.calls[0]?.[0]).toMatchObject({ assignedTo: "LENA", originalAssignee: "JULIA" });
    expect(tenners.completeTenner.mock.calls[0]?.[1].completion.originalAssigneeBefore).toBeUndefined();
  });

  it("ignores expired handovers and handovers of other categories", async () => {
    const base = tennerFixture({ assignmentMode: "ROTATING", rotation, assignedTo: "STEFAN", category: "HOUSEHOLD" });
    const expired = complete(base, [handover("JULIA", "LENA", "2026-10-04")]);
    await expired.service.completeTenner(TEST_IDENTITY, "t-1", {});
    expect(expired.tenners.completeTenner.mock.calls[0]?.[0]).toMatchObject({ assignedTo: "JULIA", originalAssignee: null });
    const other = complete(base, [{ ...handover("JULIA", "LENA"), categories: ["HOME"] }]);
    await other.service.completeTenner(TEST_IDENTITY, "t-1", {});
    expect(other.tenners.completeTenner.mock.calls[0]?.[0]).toMatchObject({ assignedTo: "JULIA", originalAssignee: null });
  });

  it("fixed Tenners keep their cover on completion", async () => {
    const { tenners, service } = complete(tennerFixture({ assignedTo: "JULIA", originalAssignee: "STEFAN" }), [handover("STEFAN", "JULIA")]);
    await service.completeTenner(TEST_IDENTITY, "t-1", {});
    expect(tenners.completeTenner.mock.calls[0]?.[0]).toMatchObject({ assignedTo: "JULIA", originalAssignee: "STEFAN" });
  });

  it("undo restores assignee and handover state", async () => {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(tennerFixture({ assignmentMode: "ROTATING", rotation, assignedTo: "LENA", originalAssignee: null, lastCompleted: "2026-10-05T08:00:00Z" }));
    tenners.undoCompletion.mockResolvedValue(undefined);
    const history = mockCompletionRepository();
    history.getLatestActiveCompletions.mockResolvedValue([completionFixture({ completedAt: "2026-10-05T08:00:00Z", assignedToBefore: "JULIA", originalAssigneeBefore: "STEFAN" })]);
    await new UndoCompletionService(tenners, history, () => NOW, async () => "UTC").undoLatestCompletion(TEST_IDENTITY, "t-1", {});
    expect(tenners.undoCompletion.mock.calls[0]?.[0]).toMatchObject({ assignedTo: "JULIA", originalAssignee: "STEFAN" });
  });
});

describe("DynamoDbHouseholdRepository handovers", () => {
  const client = (impl: () => Promise<unknown>) => ({ send: vi.fn<(command: unknown) => Promise<unknown>>(impl) });
  const stored = { from: "STEFAN", to: "JULIA", until: "2026-10-12", categories: ["HOME", "bad"], createdAt: "t", createdBy: "STEFAN" };

  it("reads handovers and drops malformed entries", async () => {
    const c = client(async () => ({ Item: { tenantId: "default", handoversVersion: 3, handovers: [stored, { ...stored, from: "bad id" }, { ...stored, from: "LENA", categories: [] }, "x"] } }));
    const settings = await new DynamoDbHouseholdRepository(c, "t").get("default");
    expect(settings?.handovers).toEqual([
      { ...stored, categories: ["HOME"] },
      { ...stored, from: "LENA", categories: null },
    ]);
    expect(settings?.handoversVersion).toBe(3);
    const empty = await new DynamoDbHouseholdRepository(client(async () => ({ Item: { tenantId: "default", handovers: [{ from: "STEFAN", to: "JULIA", until: "x" }] } })), "t").get("default");
    expect(empty).toMatchObject({ handovers: [{ createdAt: "", createdBy: "", categories: null }], handoversVersion: 0 });
    expect((await new DynamoDbHouseholdRepository(client(async () => ({ Item: { tenantId: "default" } })), "t").get("default"))?.handovers).toEqual([]);
  });

  it("saves with optimistic locking on handoversVersion", async () => {
    const c = client(async () => ({ Attributes: { tenantId: "default", handovers: [stored], handoversVersion: 2 } }));
    await new DynamoDbHouseholdRepository(c, "tenner-households").saveHandovers("default", [], 1, "STEFAN", "t");
    expect((c.send.mock.calls[0]?.[0] as UpdateCommand).input).toMatchObject({
      ConditionExpression: "#version = :expectedVersion",
      ExpressionAttributeNames: { "#list": "handovers", "#version": "handoversVersion" },
      ExpressionAttributeValues: { ":list": [], ":expectedVersion": 1, ":nextVersion": 2 },
    });
  });
});
