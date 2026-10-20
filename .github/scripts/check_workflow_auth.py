#!/usr/bin/env python3
"""Regression guard for the 2026-10-19/20 auto-merge.yml incident.

Incident: .github/workflows/auto-merge.yml had the literal string '***'
hardcoded in Authorization headers instead of a real $GH_TOKEN shell
variable reference. Every automated merge silently 401'd for an unknown
period because GET calls on this public repo don't need auth (so they kept
"working" and masked the bug) while PUT/POST calls (merging) quietly failed.
actionlint would NOT catch this -- a hardcoded string is valid shell/YAML.

This script is deliberately narrow and low-false-positive:

  1. Hard floor: fail if any workflow file contains the exact bug string
     "Authorization: token ***" or "Authorization: Bearer ***" (and a few
     obviously-fake placeholder variants), case-insensitive on the scheme.
  2. More general check: for every curl call's Authorization header value
     (token/bearer/basic), require it to reference a real variable -- i.e.
     contain '$' (shell var) or '${{' (GitHub Actions expression). A
     quoted literal with neither is flagged.

Exit non-zero and print every offending file:line on failure.
"""
import pathlib
import re
import sys

WORKFLOWS_DIR = pathlib.Path(__file__).resolve().parent.parent / "workflows"

# Exact bug + obvious placeholder variants -- the hard floor.
FAKE_TOKEN_PATTERN = re.compile(
    r"Authorization:\s*(token|bearer|basic)\s+"
    r"(\*{2,}|x{3,}|redacted|replace[_-]?me|your[_-]?token|fake[_-]?token|changeme)",
    re.IGNORECASE,
)

# General case: any Authorization header value assigned in a curl -H flag.
AUTH_HEADER_PATTERN = re.compile(
    r"Authorization:\s*(token|bearer|basic)\s+([^\"'\\\n]*)",
    re.IGNORECASE,
)


def check_file(path: pathlib.Path) -> list[str]:
    errors = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for lineno, line in enumerate(lines, start=1):
        if FAKE_TOKEN_PATTERN.search(line):
            errors.append(
                f"{path}:{lineno}: literal/placeholder token in Authorization "
                f"header (exact bug class from the 2026-10 incident): {line.strip()}"
            )
            continue  # already flagged by the hard floor; don't double-report

        m = AUTH_HEADER_PATTERN.search(line)
        if m:
            value = m.group(2)
            if "$" not in value:
                errors.append(
                    f"{path}:{lineno}: Authorization header value has no '$' "
                    f"(not a shell var or GitHub Actions expression) -- looks "
                    f"like a hardcoded literal: {line.strip()}"
                )
    return errors


def main() -> int:
    if not WORKFLOWS_DIR.is_dir():
        print(f"no workflows directory found at {WORKFLOWS_DIR}", file=sys.stderr)
        return 1

    all_errors: list[str] = []
    for path in sorted(WORKFLOWS_DIR.glob("*.yml")) + sorted(WORKFLOWS_DIR.glob("*.yaml")):
        all_errors.extend(check_file(path))

    if all_errors:
        print("Found hardcoded/fake auth tokens in workflow files:\n")
        for e in all_errors:
            print(f"  - {e}")
        print(
            "\nAuthorization header values must reference a real secret via "
            "a shell variable ($VAR) or GitHub Actions expression (${{ secrets.X }}), "
            "never a literal string. See AGENTS.md for the incident this guards against."
        )
        return 1

    print(f"OK: no hardcoded/fake auth tokens found in {WORKFLOWS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
