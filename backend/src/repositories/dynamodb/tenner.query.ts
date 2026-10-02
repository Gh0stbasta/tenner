/**
 * Builds the DynamoDB Query for Tenner criteria. Always a Query on the tenant partition (never a Scan):
 *   assignedTo given        → assignedTo-index (tenantId, assignedTo = :assignedTo)
 *   nextDue bound given     → nextDue-index    (tenantId, nextDue <= / < :date)
 *   otherwise               → base table       (tenantId)
 * Remaining criteria become a FilterExpression.
 */

import type { QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { TennerCriteria } from "../tenner.repository.js";

export const INDEX_NEXT_DUE = "nextDue-index";
export const INDEX_ASSIGNED_TO = "assignedTo-index";

/** Condition matching items that are not soft-deleted (deletedAt missing or null). */
export const NOT_DELETED = "(attribute_not_exists(#deletedAt) OR #deletedAt = :null)";

/** Condition matching soft-deleted items only (TICKET-024). */
export const ONLY_DELETED = `NOT ${NOT_DELETED}`;

type Condition = { readonly name: string; readonly op: "=" | "<=" | "<"; readonly value: unknown };

export function buildTennerQuery(tableName: string, tenantId: string, criteria: TennerCriteria = {}): QueryCommandInput {
  const nextDue: Condition | undefined =
    criteria.nextDueBefore !== undefined
      ? { name: "nextDue", op: "<", value: criteria.nextDueBefore }
      : criteria.nextDueOnOrBefore !== undefined
        ? { name: "nextDue", op: "<=", value: criteria.nextDueOnOrBefore }
        : undefined;

  const conditions: Condition[] = [];
  if (criteria.assignedTo !== undefined) conditions.push({ name: "assignedTo", op: "=", value: criteria.assignedTo });
  if (nextDue) conditions.push(nextDue);
  if (criteria.category !== undefined) conditions.push({ name: "category", op: "=", value: criteria.category });
  if (criteria.active !== undefined) conditions.push({ name: "active", op: "=", value: criteria.active });

  // The first condition on an indexed attribute becomes the sort-key condition.
  const keyCondition = conditions.find((c) => c.name === "assignedTo") ?? conditions.find((c) => c.name === "nextDue");
  const indexName = keyCondition?.name === "assignedTo" ? INDEX_ASSIGNED_TO : keyCondition ? INDEX_NEXT_DUE : undefined;
  const filters = conditions.filter((c) => c !== keyCondition);

  const names: Record<string, string> = { "#tenantId": "tenantId" };
  const values: Record<string, unknown> = { ":tenantId": tenantId };
  const expr = (c: Condition): string => {
    names[`#${c.name}`] = c.name;
    values[`:${c.name}`] = c.value;
    return `#${c.name} ${c.op} :${c.name}`;
  };

  const keyConditionExpression = ["#tenantId = :tenantId", ...(keyCondition ? [expr(keyCondition)] : [])].join(" AND ");
  const filterParts = filters.map(expr);
  if (criteria.onlyDeleted || !criteria.includeDeleted) {
    names["#deletedAt"] = "deletedAt";
    values[":null"] = null;
    filterParts.push(criteria.onlyDeleted ? ONLY_DELETED : NOT_DELETED);
  }
  const filterExpression = filterParts.join(" AND ");

  return {
    TableName: tableName,
    ...(indexName ? { IndexName: indexName } : {}),
    KeyConditionExpression: keyConditionExpression,
    ...(filterExpression ? { FilterExpression: filterExpression } : {}),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}
