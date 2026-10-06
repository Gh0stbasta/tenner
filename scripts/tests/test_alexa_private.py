"""ALEXA-010: the Alexa skill stays private. Run: python3 -m unittest discover -s scripts/tests"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# SMAPI/ASK CLI operations that would expose the skill beyond the development stage.
FORBIDDEN = re.compile(r"submit-skill-for-certification|publish-skill|certification|create-beta-test|start-beta-test|add-testers-to-beta-test|-g\s+live|--stage\s+live", re.IGNORECASE)


class AlexaSkillStaysPrivateTest(unittest.TestCase):
    def test_no_workflow_or_script_publishes_the_skill(self):
        files = [*ROOT.joinpath(".github", "workflows").glob("*.yml"), *ROOT.joinpath("scripts").glob("*.sh")]
        self.assertTrue(files)
        for path in files:
            with self.subTest(path=path.name):
                self.assertIsNone(FORBIDDEN.search(path.read_text(encoding="utf-8")))

    def test_scripts_target_the_development_stage(self):
        for name in ["deploy-alexa-skill.sh", "alexa-health-check.sh"]:
            with self.subTest(script=name):
                self.assertIn('STAGE="development"', ROOT.joinpath("scripts", name).read_text(encoding="utf-8"))

    def test_manifest_is_limited_to_germany(self):
        manifest = json.loads(ROOT.joinpath("alexa", "skill-package", "skill.json").read_text(encoding="utf-8"))["manifest"]
        publishing = manifest["publishingInformation"]
        self.assertFalse(publishing["isAvailableWorldwide"])
        self.assertEqual(publishing["distributionCountries"], ["DE"])
        self.assertIn("never submitted", publishing["testingInstructions"])


if __name__ == "__main__":
    unittest.main()
