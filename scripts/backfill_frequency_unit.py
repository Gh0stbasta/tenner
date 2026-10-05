#!/usr/bin/env python3
"""Optional backfill of frequencyUnit/frequencyInterval for Tenners stored before SCHEDULING-001.

Not required: the API reads items without `frequencyUnit` as DAY with `frequencyInterval = frequencyDays`.
The backfill only makes the stored data explicit.

Idempotent and safe to re-run:
- Dry run by default; `--apply` writes.
- Each write is conditional on `attribute_not_exists(frequencyUnit)`, so items changed by the API in the
  meantime are skipped, never overwritten.
- `updatedAt` is not changed (the meaning of the item stays the same), so concurrent completions are not
  rejected as conflicts.

Requires boto3 and credentials with dynamodb:Scan and dynamodb:UpdateItem on the table (e.g. AWS CloudShell).
The API Lambda role intentionally has neither Scan nor this script's permissions.

Usage:
    python3 scripts/backfill_frequency_unit.py [--table tenner-tenners] [--region eu-central-1] [--apply]
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from typing import Any, Protocol

DEFAULT_TABLE = "tenner-tenners"
DEFAULT_REGION = "eu-central-1"
DEFAULT_UNIT = "DAY"


@dataclass(frozen=True)
class Backfill:
    """One item that needs frequencyUnit/frequencyInterval."""

    tenant_id: str
    tenner_id: str
    frequency_interval: int


class TableClient(Protocol):
    """The subset of the boto3 DynamoDB client this script uses."""

    def get_paginator(self, operation_name: str) -> Any: ...

    def update_item(self, **kwargs: Any) -> Any: ...


def plan_backfill(items: Iterable[dict[str, Any]]) -> list[Backfill]:
    """Items (low-level attribute values) without frequencyUnit and with a numeric frequencyDays."""
    planned: list[Backfill] = []
    for item in items:
        if "frequencyUnit" in item:
            continue
        days = item.get("frequencyDays", {}).get("N")
        if days is None:
            continue
        planned.append(Backfill(item["tenantId"]["S"], item["tennerId"]["S"], int(days)))
    return planned


def scan_items(client: TableClient, table: str) -> Iterator[dict[str, Any]]:
    """All items of the table, reading only the attributes needed."""
    paginator = client.get_paginator("scan")
    pages = paginator.paginate(
        TableName=table,
        ProjectionExpression="tenantId, tennerId, frequencyDays, frequencyUnit",
    )
    for page in pages:
        yield from page.get("Items", [])


def apply_backfill(client: TableClient, table: str, backfill: Backfill) -> bool:
    """Write unit and interval; False if the item already has a unit (changed concurrently)."""
    try:
        client.update_item(
            TableName=table,
            Key={"tenantId": {"S": backfill.tenant_id}, "tennerId": {"S": backfill.tenner_id}},
            UpdateExpression="SET frequencyUnit = :unit, frequencyInterval = :interval",
            ConditionExpression="attribute_exists(tennerId) AND attribute_not_exists(frequencyUnit)",
            ExpressionAttributeValues={
                ":unit": {"S": DEFAULT_UNIT},
                ":interval": {"N": str(backfill.frequency_interval)},
            },
        )
    except Exception as error:  # botocore ClientError; boto3 is imported lazily
        code = getattr(error, "response", {}).get("Error", {}).get("Code")
        if code == "ConditionalCheckFailedException":
            return False
        raise
    return True


def run(client: TableClient, table: str, apply: bool) -> int:
    """Plan, optionally apply, and report. Returns the process exit code."""
    planned = plan_backfill(scan_items(client, table))
    print(f"{len(planned)} Tenner(s) without frequencyUnit in {table}.")
    if not apply:
        for backfill in planned:
            print(f"  would set DAY/{backfill.frequency_interval}: {backfill.tenant_id}/{backfill.tenner_id}")
        print("Dry run. Re-run with --apply to write.")
        return 0
    written = sum(apply_backfill(client, table, backfill) for backfill in planned)
    print(f"Updated {written}, skipped {len(planned) - written} (changed concurrently).")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--table", default=DEFAULT_TABLE)
    parser.add_argument("--region", default=DEFAULT_REGION)
    parser.add_argument("--apply", action="store_true", help="write the changes (default: dry run)")
    args = parser.parse_args(argv)
    import boto3  # noqa: PLC0415 - only needed for real runs, not for tests

    return run(boto3.client("dynamodb", region_name=args.region), args.table, args.apply)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
