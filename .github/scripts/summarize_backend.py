#!/usr/bin/env python3
"""Render a Markdown summary of a pytest run (JUnit XML + coverage.py JSON report)."""

import json
import sys
from pathlib import Path

from summary_common import junit_counts, render


def coverage(path: Path) -> dict[str, float] | None:
    if not path.is_file():
        return None
    totals = json.loads(path.read_text())["totals"]
    return {
        "statements": round(100 * totals["covered_lines"] / max(totals["num_statements"], 1), 2),
        "branches": round(100 * totals["covered_branches"] / max(totals["num_branches"], 1), 2),
        "lines": round(totals["percent_covered"], 2),
    }


def main(junit: str, cov: str) -> None:
    print(render("Backend (pytest)", junit_counts(Path(junit)), coverage(Path(cov))))


if __name__ == "__main__":
    main(*sys.argv[1:3])
