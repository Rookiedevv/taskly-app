"""Shared helpers for the CI summary scripts (standard library only)."""

import xml.etree.ElementTree as ET
from pathlib import Path


def junit_counts(path: Path) -> dict[str, int] | None:
    """Aggregate test counts across every <testsuite> in a JUnit XML file."""
    if not path.is_file():
        return None
    root = ET.parse(path).getroot()
    suites = [root] if root.tag == "testsuite" else root.iter("testsuite")
    counts = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    for suite in suites:
        for key in counts:
            counts[key] += int(suite.get(key, 0))
    counts["passed"] = counts["tests"] - counts["failures"] - counts["errors"] - counts["skipped"]
    return counts


def render(title: str, counts: dict[str, int] | None, coverage: dict[str, float] | None) -> str:
    lines = [f"### {title}", ""]
    if counts is None:
        lines.append("❌ No test report was produced – the test command probably failed before running.")
    else:
        failed = counts["failures"] + counts["errors"]
        status = "✅" if failed == 0 and counts["tests"] > 0 else "❌"
        lines.append(
            f"{status} **{counts['passed']} passed**, {failed} failed, "
            f"{counts['skipped']} skipped ({counts['tests']} total)"
        )
    if coverage:
        lines += ["", "| Coverage | % |", "|---|---:|"]
        lines += [f"| {name.capitalize()} | {value:.2f} |" for name, value in coverage.items()]
    return "\n".join(lines)
