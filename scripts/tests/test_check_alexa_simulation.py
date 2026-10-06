"""Tests for scripts/check_alexa_simulation.py. Run: python3 -m unittest discover -s scripts/tests"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import check_alexa_simulation as check  # noqa: E402


def simulation(caption="Willkommen bei Tenner. Frag mich zum Beispiel: Was ist heute fällig?", status="SUCCESSFUL", error=None):
    result = {"alexaExecutionInfo": {"alexaResponses": [{"type": "Speech", "content": {"caption": caption}}]}}
    if error:
        result["error"] = {"message": error}
    return {"id": "sim-1", "status": status, "result": result}


class CheckSimulationTest(unittest.TestCase):
    def test_passes_with_expected_words(self):
        self.assertIn("Tenner", check.check(simulation(), ["tenner"]))
        self.assertEqual(check.main(["x", "Tenner"], json.dumps(simulation())), 0)

    def test_fails_on_wrong_response(self):
        with self.assertRaises(check.SimulationError):
            check.check(simulation("Entschuldige, da ist etwas schiefgelaufen."), ["Willkommen"])
        self.assertEqual(check.main(["x", "Willkommen"], json.dumps(simulation("Fehler"))), 1)

    def test_fails_on_failed_simulation_error_or_empty_answer(self):
        for broken in [simulation(status="FAILED"), simulation(error="Skill execution returned an exception"), {"status": "SUCCESSFUL", "result": {}}, simulation(caption="")]:
            with self.subTest(broken=broken), self.assertRaises(check.SimulationError):
                check.check(broken, ["Tenner"])

    def test_failed_simulation_reports_amazons_reason(self):
        with self.assertRaisesRegex(check.SimulatorUnavailable, "'FAILED': Skill is not enabled"):
            check.check(simulation(status="FAILED", error="Skill is not enabled"), ["Tenner"])

    def test_simulator_failure_has_its_own_exit_code(self):
        failed = json.dumps(simulation(status="FAILED", error="An unexpected error occurred."))
        self.assertEqual(check.main(["x", "Tenner"], failed), 3)
        skill_error = json.dumps(simulation(error="Skill execution returned an exception"))
        self.assertEqual(check.main(["x", "Tenner"], skill_error), 1)

    def test_usage_and_invalid_json(self):
        self.assertEqual(check.main(["x"], "{}"), 2)
        self.assertEqual(check.main(["x", "Tenner"], "not json"), 1)


if __name__ == "__main__":
    unittest.main()
