"""Check the result of an Alexa skill simulation (ALEXA-009 health check).

Reads the JSON of `ask smapi get-skill-simulation` from stdin and fails unless the simulation succeeded, the skill
was invoked without an error and the spoken answer contains all expected words.

Exit codes: 0 passed, 1 the skill answered wrongly or with an error, 2 usage, 3 Amazon's simulator itself failed
(status FAILED, the skill was not reached; HOTFIX-006) - the caller retries and does not block the deploy on it.

Usage: ask smapi get-skill-simulation ... | python3 scripts/check_alexa_simulation.py "Tenner" ["word" ...]
"""

import json
import sys


class SimulationError(ValueError):
    """The simulation did not produce the expected answer."""


class SimulatorUnavailable(SimulationError):
    """Amazon's simulation service failed before the skill answered (status FAILED)."""


def spoken_text(simulation: dict) -> str:
    """The caption (spoken text) of the first Alexa response."""
    result = simulation.get("result") or {}
    error = result.get("error")
    if simulation.get("status") != "SUCCESSFUL":
        reason = f": {error.get('message', error)}" if error else ""
        raise SimulatorUnavailable(f"simulation status {simulation.get('status')!r}{reason}")
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
    except SimulatorUnavailable as error:
        print(f"Alexa simulator unavailable: {error}", file=sys.stderr)
        return 3
    except (json.JSONDecodeError, SimulationError) as error:
        print(f"Alexa health check failed: {error}", file=sys.stderr)
        return 1
    print(f"Alexa health check passed: {caption}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv, sys.stdin.read()))
