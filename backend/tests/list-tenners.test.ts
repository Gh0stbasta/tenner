import { describe, expect, it } from "vitest";
import { PersistenceError } from "../src/exceptions/index.js";
import type { Tenner } from "../src/models/index.js";
import { ListTennersService, sortTenners } from "../src/services/index.js";
import { mockTennerRepository, tennerFixture } from "./mocks/index.js";

const NOW = new Date("2026-10-10T08:00:00Z");

function setup(tenners: Tenner[] = []) {
  const repository = mockTennerRepository();
  repository.list.mockResolvedValue(tenners);
  return { repository, service: new ListTennersService(repository, () => NOW, async () => "UTC") };
}

describe("ListTennersService", () => {
  it("lists active Tenners by default", async () => {
    const { repository, service } = setup([tennerFixture()]);
    const result = await service.listTenners("default");
    expect(repository.list).toHaveBeenCalledWith("default", {
      assignedTo: undefined,
      category: undefined,
      active: true,
      nextDueBefore: undefined,
      nextDueOnOrBefore: undefined,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("tenantId");
  });

  it("translates due into nextDue <= today", async () => {
    const { repository, service } = setup();
    await service.listTenners("default", { due: true });
    expect(repository.list.mock.calls[0]?.[1]).toMatchObject({ nextDueOnOrBefore: "2026-10-10", nextDueBefore: undefined });
  });

  it("translates overdue into nextDue < today (and overdue wins over due)", async () => {
    const { repository, service } = setup();
    await service.listTenners("default", { overdue: true, due: true });
    expect(repository.list.mock.calls[0]?.[1]).toMatchObject({ nextDueBefore: "2026-10-10", nextDueOnOrBefore: undefined });
  });

  it("passes user, category and explicit active=false", async () => {
    const { repository, service } = setup();
    await service.listTenners("default", { assignedTo: "JULIA", category: "FITNESS", active: false });
    expect(repository.list.mock.calls[0]?.[1]).toMatchObject({ assignedTo: "JULIA", category: "FITNESS", active: false });
  });

  it("does not filter on due/overdue when the flags are false", async () => {
    const { repository, service } = setup();
    await service.listTenners("default", { due: false, overdue: false });
    expect(repository.list.mock.calls[0]?.[1]).toMatchObject({ nextDueBefore: undefined, nextDueOnOrBefore: undefined });
  });

  it("lists only archived Tenners without the active default (TICKET-024)", async () => {
    const { repository, service } = setup();
    await service.listTenners("default", { deleted: true });
    expect(repository.list.mock.calls[0]?.[1]).toMatchObject({ onlyDeleted: true, active: undefined });
  });

  it("keeps an explicit active filter for archived Tenners", async () => {
    const { repository, service } = setup();
    await service.listTenners("default", { deleted: true, active: false });
    expect(repository.list.mock.calls[0]?.[1]).toMatchObject({ onlyDeleted: true, active: false });
  });

  it("does not request archived Tenners for deleted=false", async () => {
    const { repository, service } = setup();
    await service.listTenners("default", { deleted: false });
    expect(repository.list.mock.calls[0]?.[1]).not.toHaveProperty("onlyDeleted");
    expect(repository.list.mock.calls[0]?.[1]).toMatchObject({ active: true });
  });

  it("returns an empty list", async () => {
    const { service } = setup([]);
    await expect(service.listTenners("default")).resolves.toEqual([]);
  });

  it("sorts by nextDue ascending by default", async () => {
    const { service } = setup([
      tennerFixture({ tennerId: "b", nextDue: "2026-10-12" }),
      tennerFixture({ tennerId: "a", nextDue: "2026-10-01" }),
    ]);
    expect((await service.listTenners("default")).map((t) => t.tennerId)).toEqual(["a", "b"]);
  });

  it("propagates repository failures", async () => {
    const repository = mockTennerRepository();
    repository.list.mockRejectedValue(new PersistenceError());
    await expect(new ListTennersService(repository, () => NOW, async () => "UTC").listTenners("default")).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("sortTenners", () => {
  const tenners = [
    tennerFixture({ tennerId: "1", title: "B", nextDue: "2026-10-02", createdAt: "2026-01-02T00:00:00Z" }),
    tennerFixture({ tennerId: "2", title: "A", nextDue: "2026-10-02", createdAt: "2026-01-01T00:00:00Z" }),
    tennerFixture({ tennerId: "3", title: "C", nextDue: "2026-10-01", createdAt: "2026-01-03T00:00:00Z" }),
  ];

  it("sorts by field and breaks ties by title", () => {
    expect(sortTenners(tenners, "nextDue", "asc").map((t) => t.tennerId)).toEqual(["3", "2", "1"]);
  });

  it("sorts descending", () => {
    expect(sortTenners(tenners, "createdAt", "desc").map((t) => t.tennerId)).toEqual(["3", "1", "2"]);
  });

  it("sorts by title", () => {
    expect(sortTenners(tenners, "title", "asc").map((t) => t.title)).toEqual(["A", "B", "C"]);
  });

  it("breaks full ties by tennerId and does not mutate the input", () => {
    const same = [tennerFixture({ tennerId: "z" }), tennerFixture({ tennerId: "y" })];
    expect(sortTenners(same, "updatedAt", "asc").map((t) => t.tennerId)).toEqual(["y", "z"]);
    expect(same.map((t) => t.tennerId)).toEqual(["z", "y"]);
  });
});
