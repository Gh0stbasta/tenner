import { describe, expect, it } from "vitest";
import { buildTennerQuery } from "../src/repositories/dynamodb/tenner.query.js";

describe("buildTennerQuery", () => {
  it("queries the tenant partition of the base table without criteria (never a scan)", () => {
    expect(buildTennerQuery("tenner-tenners", "default")).toEqual({
      TableName: "tenner-tenners",
      KeyConditionExpression: "#tenantId = :tenantId",
      ExpressionAttributeNames: { "#tenantId": "tenantId" },
      ExpressionAttributeValues: { ":tenantId": "default" },
    });
  });

  it("filters active and category on the base table", () => {
    expect(buildTennerQuery("t", "default", { active: true, category: "HOME" })).toMatchObject({
      KeyConditionExpression: "#tenantId = :tenantId",
      FilterExpression: "#category = :category AND #active = :active",
      ExpressionAttributeValues: { ":tenantId": "default", ":category": "HOME", ":active": true },
    });
  });

  it("uses assignedTo-index for a user filter and filters the due bound", () => {
    const input = buildTennerQuery("t", "default", { assignedTo: "STEFAN", nextDueOnOrBefore: "2026-10-10", active: true });
    expect(input).toMatchObject({
      IndexName: "assignedTo-index",
      KeyConditionExpression: "#tenantId = :tenantId AND #assignedTo = :assignedTo",
      FilterExpression: "#nextDue <= :nextDue AND #active = :active",
    });
  });

  it("uses nextDue-index for due (<=) and overdue (<)", () => {
    expect(buildTennerQuery("t", "default", { nextDueOnOrBefore: "2026-10-10" })).toMatchObject({
      IndexName: "nextDue-index",
      KeyConditionExpression: "#tenantId = :tenantId AND #nextDue <= :nextDue",
    });
    const overdue = buildTennerQuery("t", "default", { nextDueBefore: "2026-10-10", nextDueOnOrBefore: "2026-10-10" });
    expect(overdue).toMatchObject({ IndexName: "nextDue-index", KeyConditionExpression: "#tenantId = :tenantId AND #nextDue < :nextDue" });
    expect(overdue).not.toHaveProperty("FilterExpression");
  });

  it("supports active=false", () => {
    expect(buildTennerQuery("t", "default", { active: false }).ExpressionAttributeValues).toMatchObject({ ":active": false });
  });
});
