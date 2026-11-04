#!/usr/bin/env python3
"""Decide whether a change set is worth running the test agent on.

Reads changed paths (one per line) from stdin and prints GitHub Actions outputs:
  run=true|false      – at least one production source file changed
  reason=<text>       – human-readable explanation
  changed_source=<n>  – number of production source files in the change set

The classification mirrors the analyze-pr-changes skill and the coverage
exclusions in frontend/vite.config.ts and backend/pyproject.toml. The agent
makes the fine-grained per-file decisions; this gate only avoids spending an
agent run on docs-, config- or test-only pull requests.
"""

import fnmatch
import os
import sys

SOURCE_GLOBS = ["backend/app/**", "frontend/src/**"]
EXCLUDED_GLOBS = [
    # backend – excluded from coverage or not unit-testable on their own
    "backend/app/**/__init__.py",
    "backend/app/main.py",
    "backend/app/**/schemas.py",
    "backend/app/**/models.py",
    "backend/app/**/types.py",
    "backend/app/**/constants.py",
    # frontend – excluded from coverage
    "frontend/src/main.tsx",
    "frontend/src/test/**",
    "frontend/src/**/*.test.ts",
    "frontend/src/**/*.test.tsx",
    "frontend/src/**/*.stories.tsx",
    "frontend/src/**/*.styles.ts",
    "frontend/src/**/*.variants.ts",
    "frontend/src/design-system/**",
    "frontend/src/**/types.ts",
    "frontend/src/**/*.types.ts",
    "frontend/src/**/index.ts",
    "frontend/src/**/constants.ts",
    "frontend/src/**/*.constants.ts",
    "frontend/src/features/todos/api/queryKeys.ts",
    "frontend/src/lib/queryClient.ts",
    "frontend/src/styles.css",
]


def matches(path: str, patterns: list[str]) -> bool:
    # fnmatch's "*" matches "/" too, which gives us "**" semantics for free.
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)


def is_production_source(path: str) -> bool:
    return matches(path, SOURCE_GLOBS) and not matches(path, EXCLUDED_GLOBS)


def main() -> None:
    changed = [line.strip() for line in sys.stdin if line.strip()]
    source = [path for path in changed if is_production_source(path)]
    tests_only = [p for p in changed if matches(p, ["backend/tests/**", "frontend/src/**/*.test.*"])]

    if source:
        reason = f"{len(source)} production source file(s) changed"
    elif tests_only and len(tests_only) == len(changed):
        reason = "only test files changed"
    elif not changed:
        reason = "no files changed"
    else:
        reason = "no production source files changed (docs, config or excluded paths only)"

    outputs = {
        "run": "true" if source else "false",
        "reason": reason,
        "changed_source": str(len(source)),
    }
    out = os.environ.get("GITHUB_OUTPUT")
    with open(out, "a") if out else sys.stdout as handle:
        for key, value in outputs.items():
            handle.write(f"{key}={value}\n")
    print(f"test agent: run={outputs['run']} ({reason})", file=sys.stderr)
    for path in source:
        print(f"  source: {path}", file=sys.stderr)


if __name__ == "__main__":
    main()
