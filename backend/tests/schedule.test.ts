/** SCHEDULING-001: calendar-based frequencies. */

import { describe, expect, it } from "vitest";
import { toTenner } from "../src/repositories/dynamodb/tenner.mapper.js";
import { addMonths, approximateFrequencyDays, calculateNextDue } from "../src/utils/schedule.js";
import { createTennerSchema, updateTennerSchema, validate } from "../src/validators/index.js";
import { ValidationError } from "../src/exceptions/index.js";

describe("calculateNextDue", () => {
  it.each([
    ["Daily", "DAY", 1, "2026-10-02"],
    ["Weekly", "WEEK", 1, "2026-10-08"],
    ["Every 3 days", "DAY", 3, "2026-10-04"],
    ["Every 2 weeks", "WEEK", 2, "2026-10-15"],
    ["Monthly", "MONTH", 1, "2026-11-01"],
    ["Quarterly", "MONTH", 3, "2027-01-01"],
    ["Yearly", "YEAR", 1, "2027-10-01"],
  ] as const)("%s", (_name, unit, interval, expected) => {
    expect(calculateNextDue("2026-10-01", unit, interval)).toBe(expected);
  });

  it("clamps month ends to the last day of the target month", () => {
    expect(calculateNextDue("2026-01-31", "MONTH", 1)).toBe("2026-02-28");
    expect(calculateNextDue("2026-03-31", "MONTH", 1)).toBe("2026-04-30");
    expect(calculateNextDue("2026-08-31", "MONTH", 3)).toBe("2026-11-30");
    expect(calculateNextDue("2026-01-30", "MONTH", 1)).toBe("2026-02-28");
  });

  it("handles leap years", () => {
    expect(calculateNextDue("2028-01-31", "MONTH", 1)).toBe("2028-02-29");
    expect(calculateNextDue("2028-02-29", "YEAR", 1)).toBe("2029-02-28");
    expect(calculateNextDue("2028-02-29", "YEAR", 4)).toBe("2032-02-29");
    expect(calculateNextDue("2100-01-31", "MONTH", 1)).toBe("2100-02-28");
    expect(calculateNextDue("2028-02-28", "DAY", 1)).toBe("2028-02-29");
  });

  it("crosses year boundaries", () => {
    expect(calculateNextDue("2026-12-31", "DAY", 1)).toBe("2027-01-01");
    expect(calculateNextDue("2026-12-15", "MONTH", 1)).toBe("2027-01-15");
    expect(calculateNextDue("2026-11-30", "MONTH", 3)).toBe("2027-02-28");
    expect(calculateNextDue("2026-12-28", "WEEK", 1)).toBe("2027-01-04");
    expect(addMonths("2026-10-01", 120)).toBe("2036-10-01");
  });

  it("derives frequencyDays exactly for DAY/WEEK and approximately for MONTH/YEAR", () => {
    expect(approximateFrequencyDays("DAY", 3)).toBe(3);
    expect(approximateFrequencyDays("WEEK", 2)).toBe(14);
    expect(approximateFrequencyDays("MONTH", 3)).toBe(90);
    expect(approximateFrequencyDays("YEAR", 1)).toBe(365);
  });
});

describe("frequency validation", () => {
  const base = { title: "Review finances", category: "FINANCE", estimatedMinutes: 30, assignedTo: "JULIA" };
  const fieldsOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return (error as ValidationError).details?.map((d) => d.field);
    }
    throw new Error("expected a validation error");
  };

  it("accepts unit and interval and derives frequencyDays", () => {
    expect(validate(createTennerSchema, { ...base, frequencyUnit: "MONTH", frequencyInterval: 3 })).toMatchObject({
      frequencyUnit: "MONTH",
      frequencyInterval: 3,
      frequencyDays: 90,
    });
    expect(validate(createTennerSchema, { ...base, frequencyUnit: "YEAR" })).toMatchObject({ frequencyUnit: "YEAR", frequencyInterval: 1, frequencyDays: 365 });
  });

  it("keeps requests with only frequencyDays valid (backward compatible)", () => {
    expect(validate(createTennerSchema, { ...base, frequencyDays: 30 })).toMatchObject({ frequencyUnit: "DAY", frequencyInterval: 30, frequencyDays: 30 });
  });

  it("rejects mixed forms, interval without unit, unknown units and too long frequencies", () => {
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyDays: 30, frequencyUnit: "MONTH" }))).toEqual(["frequencyDays"]);
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyInterval: 2 }))).toEqual(["frequencyUnit"]);
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyUnit: "HOUR", frequencyInterval: 2 }))).toEqual(["frequencyUnit"]);
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyUnit: "MONTH", frequencyInterval: 0 }))).toEqual(["frequencyInterval"]);
    expect(fieldsOf(() => validate(createTennerSchema, { ...base, frequencyUnit: "YEAR", frequencyInterval: 11 }))).toEqual(["frequencyInterval"]);
    expect(validate(createTennerSchema, { ...base, frequencyUnit: "YEAR", frequencyInterval: 10 })).toMatchObject({ frequencyDays: 3650 });
  });

  it("normalizes frequency changes in updates", () => {
    expect(validate(updateTennerSchema, { frequencyUnit: "MONTH" })).toEqual({ frequencyUnit: "MONTH", frequencyInterval: 1, frequencyDays: 30, weekdays: null });
    expect(validate(updateTennerSchema, { frequencyUnit: "WEEK", frequencyInterval: 2 })).toEqual({ frequencyUnit: "WEEK", frequencyInterval: 2, frequencyDays: 14, weekdays: null });
    expect(fieldsOf(() => validate(updateTennerSchema, { frequencyInterval: 2 }))).toEqual(["frequencyUnit"]);
  });
});

describe("toTenner frequency defaults", () => {
  const item = { tenantId: "default", tennerId: "t-1", title: "x", category: "HOUSEHOLD", estimatedMinutes: 5, frequencyDays: 14, assignedTo: "STEFAN", nextDue: "2026-10-01", active: true };

  it("reads items without a unit as DAY with interval = frequencyDays", () => {
    expect(toTenner(item)).toMatchObject({ frequencyUnit: "DAY", frequencyInterval: 14, frequencyDays: 14 });
    expect(toTenner({ ...item, frequencyUnit: "FORTNIGHT", frequencyInterval: 2 })).toMatchObject({ frequencyUnit: "DAY", frequencyInterval: 14 });
  });

  it("reads stored units and intervals", () => {
    expect(toTenner({ ...item, frequencyDays: 90, frequencyUnit: "MONTH", frequencyInterval: 3 })).toMatchObject({ frequencyUnit: "MONTH", frequencyInterval: 3 });
  });
});
