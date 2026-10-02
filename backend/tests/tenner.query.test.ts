import { describe, expect, it } from "vitest";
import { buildTennerQuery } from "../src/repositories/dynamodb/tenner.query.js";

describe("buildTennerQuery", () => {
  it("queries the tenant partition of the base table and excludes deleted Tenners by default (never a scan)", () => {
    expect(buildTennerQuery("tenner-tenners", "default")).toEqual({
      TableName: "tenner-tenners",
      KeyConditionExpression: "#tenantId = :tenantId",
      FilterExpression: "(attribute_not_exists(#deletedAt) OR #deletedAt = :null)",
      ExpressionAttributeNames: { "#tenantId": "tenantId", "#deletedAt": "deletedAt" },
      ExpressionAttributeValues: { ":tenantId": "default", ":null": null },
    });
  });

  it("includes deleted Tenners on request", () => {
    expect(buildTennerQuery("t", "default", { includeDeleted: true })).not.toHaveProperty("FilterExpression");
  });

  it("filters active and category on the base table", () => {
    expect(buildTennerQuery("t", "default", { active: true, category: "HOME" })).toMatchObject({
      KeyConditionExpression: "#tenantId = :tenantId",
      FilterExpression: "#category = :category AND #active = :active AND (attribute_not_exists(#deletedAt) OR #deletedAt = :null)",
      ExpressionAttributeValues: { ":tenantId": "default", ":category": "HOME", ":active": true },
    });
  });

  it("uses assignedTo-index for a user filter and filters the due bound", () => {
    const input = buildTennerQuery("t", "default", { assignedTo: "STEFAN", nextDueOnOrBefore: "2026-10-10", active: true });
    expect(input).toMatchObject({
      IndexName: "assignedTo-index",
      KeyConditionExpression: "#tenantId = :tenantId AND #assignedTo = :assignedTo",
      FilterExpression: "#nextDue <= :nextDue AND #active = :active AND (attribute_not_exists(#deletedAt) OR #deletedAt = :null)",
    });
  });

  it("uses nextDue-index for due (<=) and overdue (<)", () => {
    expect(buildTennerQuery("t", "default", { nextDueOnOrBefore: "2026-10-10" })).toMatchObject({
      IndexName: "nextDue-index",
      KeyConditionExpression: "#tenantId = :tenantId AND #nextDue <= :nextDue",
    });
    const overdue = buildTennerQuery("t", "default", { nextDueBefore: "2026-10-10", nextDueOnOrBefore: "2026-10-10", includeDeleted: true });
    expect(overdue).toMatchObject({ IndexName: "nextDue-index", KeyConditionExpression: "#tenantId = :tenantId AND #nextDue < :nextDue" });
    expect(overdue).not.toHaveProperty("FilterExpression");
  });

  it("supports active=false", () => {
    expect(buildTennerQuery("t", "default", { active: false }).ExpressionAttributeValues).toMatchObject({ ":active": false });
  });
});
