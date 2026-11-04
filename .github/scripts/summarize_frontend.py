#!/usr/bin/env python3
"""Render a Markdown summary of a Vitest run (JUnit XML + v8 coverage-summary.json)."""

import json
import sys
from pathlib import Path

from summary_common import junit_counts, render


def coverage(path: Path) -> dict[str, float] | None:
    if not path.is_file():
        return None
    total = json.loads(path.read_text())["total"]
    return {
        "statements": total["statements"]["pct"],
        "branches": total["branches"]["pct"],
        "functions": total["functions"]["pct"],
        "lines": total["lines"]["pct"],
    }


def main(junit: str, cov: str) -> None:
    print(render("Frontend (Vitest)", junit_counts(Path(junit)), coverage(Path(cov))))


if __name__ == "__main__":
    main(*sys.argv[1:3])
