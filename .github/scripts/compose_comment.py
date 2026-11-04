#!/usr/bin/env python3
"""Assemble the pull request comment posted by the test-agent workflow.

Usage: compose_comment.py <report.md or -> <run_url> <agent_outcome> [--verification JSON]

The agent's own report comes first (it is the agent's voice: decisions, skills,
its local test run). The workflow appends an "Independent verification" section
with the results of the reusable CI workflow on the commit it pushed, next to the
baseline run on the commit the PR had before – so coverage deltas are visible and
the pass/fail verdict does not rely on the agent's self-report.
"""

import argparse
import json
import sys
from pathlib import Path

MARKER = "<!-- taskly-test-agent-report -->"


def read_report(path: str) -> str:
    if path == "-":
        return sys.stdin.read()
    file = Path(path)
    if not file.is_file():
        return (
            "## 🧪 Test agent report\n\n"
            "⚠️ The agent did not produce a report. See the workflow run for details."
        )
    return file.read_text().strip()


def verification_section(agent_outcome: str, verification: dict | None, run_url: str) -> str:
    lines = ["### Independent verification (workflow)", ""]
    if agent_outcome != "success":
        lines.append(f"❌ The agent step finished with status `{agent_outcome}`. No tests were committed. [Run log]({run_url})")
        return "\n".join(lines)
    if not verification:
        lines.append(f"ℹ️ The agent changed no test files, so there was nothing new to verify. [Run log]({run_url})")
        return "\n".join(lines)

    status = "✅ Full test suites pass on the committed tests." if verification.get("passed") else "❌ The committed tests do not pass – see the run log."
    lines.append(status)
    if verification.get("commit"):
        lines.append(f"Verified commit: `{verification['commit'][:7]}` · [Run log]({run_url})")
    lines.append("")

    for stack in ("frontend", "backend"):
        before = verification.get("baseline", {}).get(stack) or ""
        after = verification.get("after", {}).get(stack) or ""
        if not after:
            continue
        lines.append(f"<details><summary><b>{stack.capitalize()}</b> – after the agent's commit</summary>\n")
        lines.append(after.strip())
        lines.append("\n</details>")
        if before:
            lines.append(f"<details><summary>{stack.capitalize()} – before (baseline)</summary>\n")
            lines.append(before.strip())
            lines.append("\n</details>")
        lines.append("")
    return "\n".join(lines).rstrip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("report")
    parser.add_argument("run_url")
    parser.add_argument("agent_outcome")
    parser.add_argument("--verification", help="JSON with keys passed, commit, baseline{frontend,backend}, after{frontend,backend}")
    args = parser.parse_args()

    verification = json.loads(args.verification) if args.verification else None
    body = "\n\n".join([MARKER, read_report(args.report), verification_section(args.agent_outcome, verification, args.run_url)])
    print(body)


if __name__ == "__main__":
    main()
