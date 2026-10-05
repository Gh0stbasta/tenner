/** SCHEDULING-002: weekday-based scheduling. */

import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/exceptions/index.js";
import { toTenner } from "../src/repositories/dynamodb/tenner.mapper.js";
import { CompleteTennerService } from "../src/services/index.js";
import { approximateFrequencyDays, calculateNextDue, weekdayOf } from "../src/utils/schedule.js";
import { createTennerSchema, updateTennerSchema, validate } from "../src/validators/index.js";
import { mockCompletionRepository, mockTennerRepository, tennerFixture, TEST_IDENTITY } from "./mocks/index.js";

describe("calculateNextDue with weekdays", () => {
  it.each([
    // Documented examples
    ["every Saturday, completed Sat", "2026-10-03", 1, ["SAT"], "2026-10-10"],
    ["every Saturday, completed late on Mon", "2026-10-05", 1, ["SAT"], "2026-10-10"],
    ["every Tue + Fri, completed Tue", "2026-10-06", 1, ["TUE", "FRI"], "2026-10-09"],
    // Multiple weekdays
    ["every Tue + Fri, completed Fri", "2026-10-09", 1, ["TUE", "FRI"], "2026-10-13"],
    ["every Tue + Fri, completed Wed", "2026-10-07", 1, ["TUE", "FRI"], "2026-10-09"],
    // Bi-weekly
    ["every second Friday, completed Fri", "2026-10-02", 2, ["FRI"], "2026-10-16"],
    ["every second Friday, completed early on Wed", "2026-09-30", 2, ["FRI"], "2026-10-09"],
    // Early completion
    ["every Saturday, completed early on Thu", "2026-10-01", 1, ["SAT"], "2026-10-03"],
    // Week and year boundaries
    ["every Monday, completed Sun", "2026-10-04", 1, ["MON"], "2026-10-05"],
    ["every Monday, completed Mon at year end", "2026-12-28", 1, ["MON"], "2027-01-04"],
    ["every Friday, completed Thu 31 Dec", "2026-12-31", 1, ["FRI"], "2027-01-01"],
  ] as const)("%s", (_name, completed, interval, weekdays, expected) => {
    expect(calculateNextDue(completed, "WEEK", interval, weekdays)).toBe(expected);
  });

  it("ignores empty or missing weekdays (plain weeks)", () => {
    expect(calculateNextDue("2026-10-05", "WEEK", 1, [])).toBe("2026-10-12");
    expect(calculateNextDue("2026-10-05", "WEEK", 1, null)).toBe("2026-10-12");
  });

  it("knows the ISO weekday of a date", () => {
    expect(weekdayOf("2026-10-05")).toBe("MON");
    expect(weekdayOf("2026-10-11")).toBe("SUN");
  });

  it("approximates frequencyDays by the average gap", () => {
    expect(approximateFrequencyDays("WEEK", 1, ["TUE", "FRI"])).toBe(4);
    expect(approximateFrequencyDays("WEEK", 2, ["FRI"])).toBe(14);
    expect(approximateFrequencyDays("WEEK", 1, ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])).toBe(1);
  });
});

describe("weekday validation", () => {
  const base = { title: "Bins out", category: "HOME", estimatedMinutes: 5, assignedTo: "JULIA" };
  const fieldsOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return (error as ValidationError).details?.map((d) => d.field);
    }
    throw new Error("expected a validation error");
  };

  it("accepts weekdays with WEEK and normalizes them to ISO order", () => {
    expect(validate(createTennerSchema, { ...base, frequencyUnit: "WEEK", weekdays: ["FRI", "TUE"] })).toMatchObject({
      frequencyUnit: "WEEK",
      frequencyInterval: 1,
      weekdays: ["TUE", "FRI"],
      frequencyDays: 4,
    });
    expect(validate(createTennerSchema, { ...base, frequencyUnit: "WEEK", weekdays: null })).toMatchObject({ weekdays: null, frequencyDays: 7 });
  });

  it("rejects weekdays without the WEEK unit", () => {
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyUnit: "MONTH", weekdays: ["MON"] }))).toEqual(["weekdays"]);
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyDays: 7, weekdays: ["MON"] }))).toEqual(["weekdays"]);
    expect(fieldsOf(() => validate(updateTennerSchema, { weekdays: ["MON"] }))).toEqual(["weekdays"]);
    expect(fieldsOf(() => validate(updateTennerSchema, { weekdays: null }))).toEqual(["weekdays"]);
  });

  it("rejects empty, duplicate and unknown weekdays", () => {
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyUnit: "WEEK", weekdays: [] }))).toEqual(["weekdays"]);
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyUnit: "WEEK", weekdays: ["MON", "MON"] }))).toEqual(["weekdays"]);
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyUnit: "WEEK", weekdays: ["MONDAY"] }))).toEqual(["weekdays.0"]);
  });

  it("resets weekdays when the frequency changes without them", () => {
    expect(validate(updateTennerSchema, { frequencyUnit: "MONTH" })).toMatchObject({ weekdays: null });
  });
});

describe("weekdays in storage and completion", () => {
  const item = { tenantId: "default", tennerId: "t-1", title: "x", category: "HOME", estimatedMinutes: 5, frequencyDays: 7, frequencyUnit: "WEEK", frequencyInterval: 1, assignedTo: "STEFAN", nextDue: "2026-10-03", active: true };

  it("reads stored weekdays in ISO order and ignores them for other units", () => {
    expect(toTenner({ ...item, weekdays: ["SAT", "MON", "BOGUS"] }).weekdays).toEqual(["MON", "SAT"]);
    expect(toTenner(item).weekdays).toBeNull();
    expect(toTenner({ ...item, weekdays: [] }).weekdays).toBeNull();
    expect(toTenner({ ...item, frequencyUnit: "MONTH", weekdays: ["MON"] }).weekdays).toBeNull();
  });

  it("completes a Saturday Tenner on the next Saturday", async () => {
    const tenners = mockTennerRepository();
    tenners.getById.mockResolvedValue(tennerFixture({ frequencyUnit: "WEEK", frequencyInterval: 1, frequencyDays: 7, weekdays: ["SAT"] }));
    tenners.completeTenner.mockResolvedValue(undefined);
    const service = new CompleteTennerService(tenners, mockCompletionRepository(), () => new Date("2026-10-05T18:00:00Z"), () => "c-1", async () => "Europe/Berlin");
    await service.completeTenner(TEST_IDENTITY, "t-1", {});
    expect(tenners.completeTenner.mock.calls[0]?.[0].nextDue).toBe("2026-10-10");
  });
});
