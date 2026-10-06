"""Check the result of an Alexa skill simulation (ALEXA-009 health check).

Reads the JSON of `ask smapi get-skill-simulation` from stdin and fails unless the simulation succeeded, the skill
was invoked without an error and the spoken answer contains all expected words.

Usage: ask smapi get-skill-simulation ... | python3 scripts/check_alexa_simulation.py "Tenner" ["word" ...]
"""

import json
import sys


class SimulationError(ValueError):
    """The simulation did not produce the expected answer."""


def spoken_text(simulation: dict) -> str:
    """The caption (spoken text) of the first Alexa response."""
    if simulation.get("status") != "SUCCESSFUL":
        raise SimulationError(f"simulation status {simulation.get('status')!r}")
    result = simulation.get("result") or {}
    error = result.get("error")
    if error:
        raise SimulationError(f"simulation error: {error.get('message', error)}")
    responses = (result.get("alexaExecutionInfo") or {}).get("alexaResponses") or []
    if not responses:
        raise SimulationError("no Alexa response")
    caption = ((responses[0].get("content") or {}).get("caption")) or ""
    if not caption:
        raise SimulationError("empty answer")
    return caption


def check(simulation: dict, expected: list[str]) -> str:
    """Return the caption if it contains every expected word (case-insensitive)."""
    caption = spoken_text(simulation)
    missing = [word for word in expected if word.lower() not in caption.lower()]
    if missing:
        raise SimulationError(f"answer {caption!r} lacks {missing}")
    return caption


def main(argv: list[str], stdin_text: str) -> int:
    """Command-line entry point; returns the process exit code."""
    if len(argv) < 2:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    try:
        caption = check(json.loads(stdin_text), argv[1:])
    except (json.JSONDecodeError, SimulationError) as error:
        print(f"Alexa health check failed: {error}", file=sys.stderr)
        return 1
    print(f"Alexa health check passed: {caption}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv, sys.stdin.read()))
