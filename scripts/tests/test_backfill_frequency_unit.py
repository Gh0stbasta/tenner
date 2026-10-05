"""Tests for scripts/backfill_frequency_unit.py. Run: python3 -m unittest discover -s scripts/tests"""

import contextlib
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import backfill_frequency_unit as backfill  # noqa: E402


def item(tenner_id, days="14", unit=None):
    result = {"tenantId": {"S": "default"}, "tennerId": {"S": tenner_id}}
    if days is not None:
        result["frequencyDays"] = {"N": days}
    if unit is not None:
        result["frequencyUnit"] = {"S": unit}
    return result


class ConditionalCheckFailed(Exception):
    response = {"Error": {"Code": "ConditionalCheckFailedException"}}


class FakeClient:
    def __init__(self, pages, fail_for=()):
        self.pages = pages
        self.fail_for = set(fail_for)
        self.updates = []

    def get_paginator(self, operation_name):
        assert operation_name == "scan"
        client = self

        class Paginator:
            def paginate(self, **kwargs):
                assert kwargs["TableName"] == "tenner-tenners"
                return iter(client.pages)

        return Paginator()

    def update_item(self, **kwargs):
        tenner_id = kwargs["Key"]["tennerId"]["S"]
        if tenner_id in self.fail_for:
            raise ConditionalCheckFailed()
        self.updates.append(kwargs)


def quiet(fn):
    with contextlib.redirect_stdout(io.StringIO()) as out:
        code = fn()
    return code, out.getvalue()


class PlanTest(unittest.TestCase):
    def test_plans_only_items_without_unit(self):
        planned = backfill.plan_backfill([item("a"), item("b", unit="MONTH"), item("c", days=None)])
        self.assertEqual(planned, [backfill.Backfill("default", "a", 14)])


class RunTest(unittest.TestCase):
    def test_dry_run_writes_nothing(self):
        client = FakeClient([{"Items": [item("a")]}, {"Items": [item("b", days="7")]}])
        code, out = quiet(lambda: backfill.run(client, "tenner-tenners", apply=False))
        self.assertEqual(code, 0)
        self.assertEqual(client.updates, [])
        self.assertIn("2 Tenner(s)", out)

    def test_apply_writes_conditionally_and_is_idempotent(self):
        client = FakeClient([{"Items": [item("a"), item("b", unit="DAY")]}])
        quiet(lambda: backfill.run(client, "tenner-tenners", apply=True))
        self.assertEqual(len(client.updates), 1)
        update = client.updates[0]
        self.assertIn("attribute_not_exists(frequencyUnit)", update["ConditionExpression"])
        self.assertEqual(update["ExpressionAttributeValues"][":interval"], {"N": "14"})
        self.assertNotIn("updatedAt", update["UpdateExpression"])

    def test_skips_items_changed_concurrently(self):
        client = FakeClient([{"Items": [item("a"), item("b")]}], fail_for={"a"})
        _, out = quiet(lambda: backfill.run(client, "tenner-tenners", apply=True))
        self.assertIn("Updated 1, skipped 1", out)

    def test_other_errors_propagate(self):
        class Boom(Exception):
            response = {"Error": {"Code": "AccessDeniedException"}}

        client = FakeClient([{"Items": [item("a")]}])
        client.update_item = lambda **_: (_ for _ in ()).throw(Boom())
        with self.assertRaises(Boom):
            quiet(lambda: backfill.run(client, "tenner-tenners", apply=True))


if __name__ == "__main__":
    unittest.main()
