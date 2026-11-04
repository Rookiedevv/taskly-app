#!/usr/bin/env python3
"""Validate the working tree after the test agent ran.

Defence in depth: .claude/settings.json already denies edits outside test paths,
but the workflow re-checks the result before anything is committed. Exits 1 when:
  * a file outside the allowed test paths was modified, added or deleted,
  * the report (.test-agent/report.md) or result file (.test-agent/result.json)
    is missing or malformed.

Prints GitHub Actions outputs:
  changed=true|false   – whether any test file changed
  files=<comma list>   – the changed test files
"""

import fnmatch
import json
import os
import subprocess
import sys
from pathlib import Path

ALLOWED = [
    "backend/tests/**",
    "frontend/src/test/**",
    "frontend/src/**/*.test.ts",
    "frontend/src/**/*.test.tsx",
]
REPORT_DIR = Path(".test-agent")
# Paths the Claude Code Action restores from the base branch before the agent
# starts (so a PR cannot alter the agent's configuration). They may legitimately
# differ from the PR head and are never committed by the workflow.
RESTORED_BY_ACTION = (
    ".claude/", ".claude-pr/", ".husky/", "CLAUDE.md", "CLAUDE.local.md",
    ".mcp.json", ".claude.json", ".gitmodules", ".ripgreprc",
)
REQUIRED_REPORT_HEADINGS = ["### Decisions", "### Tests written or updated", "### Notes for reviewers"]


def changed_paths() -> list[str]:
    status = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        check=True, capture_output=True, text=True,
    ).stdout
    paths = []
    for line in status.splitlines():
        path = line[3:]
        if " -> " in path:  # rename: take the destination
            path = path.split(" -> ", 1)[1]
        paths.append(path.strip().strip('"'))
    return paths


def allowed(path: str) -> bool:
    return any(fnmatch.fnmatch(path, pattern) for pattern in ALLOWED)


def validate_report() -> list[str]:
    problems = []
    report = REPORT_DIR / "report.md"
    result = REPORT_DIR / "result.json"
    if not report.is_file():
        problems.append(f"{report} is missing")
    else:
        text = report.read_text()
        for heading in REQUIRED_REPORT_HEADINGS:
            if heading not in text:
                problems.append(f"{report} lacks the '{heading}' section")
    if not result.is_file():
        problems.append(f"{result} is missing")
    else:
        try:
            data = json.loads(result.read_text())
            for key in ("mode", "decisions", "files_written"):
                if key not in data:
                    problems.append(f"{result} lacks the '{key}' key")
        except json.JSONDecodeError as error:
            problems.append(f"{result} is not valid JSON: {error}")
    return problems


def main() -> None:
    paths = [
        p for p in changed_paths()
        if not p.startswith(".test-agent/") and not p.startswith(RESTORED_BY_ACTION)
    ]
    offending = [p for p in paths if not allowed(p)]
    test_files = [p for p in paths if allowed(p)]
    problems = validate_report()

    if offending:
        problems.append("files outside the allowed test paths were changed: " + ", ".join(offending))

    out = os.environ.get("GITHUB_OUTPUT")
    with open(out, "a") if out else sys.stdout as handle:
        handle.write(f"changed={'true' if test_files else 'false'}\n")
        handle.write(f"files={','.join(test_files)}\n")

    for path in test_files:
        print(f"test file changed: {path}", file=sys.stderr)
    if problems:
        for problem in problems:
            print(f"::error::{problem}", file=sys.stderr)
        sys.exit(1)
    print("guard: OK", file=sys.stderr)


if __name__ == "__main__":
    main()
