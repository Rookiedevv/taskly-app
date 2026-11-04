---
name: analyze-pr-changes
description: Turn a git diff (or a coverage report) into per-file test decisions for the Taskly repo – which changed modules need new tests, which existing tests must be updated, and what to skip. Use before writing any test in a PR or coverage-sweep run.
---

# Analyze PR changes

Goal: a short, defensible decision for every changed file **before** any test is
written. Over-testing wastes reviewer time; under-testing misses the point. Decide,
record the reason, then act.

## 1. Collect the change set

PR mode (the prompt gives `BASE_REF`, usually `origin/main`):

```bash
git diff --name-status "$BASE_REF"...HEAD
git diff "$BASE_REF"...HEAD -- <one source file at a time>
```

Sweep mode: run both suites with coverage (see `verify-tests`) and treat every
production module below the thresholds as "modified": frontend statements < 80 %
or backend line coverage < 80 % for that file, or any file at 0 %.

## 2. Classify each file

| Path pattern | Category | Default decision |
|---|---|---|
| `backend/app/**/*.py` except the exclusions below | backend source | `test` / `update` |
| `backend/app/**/__init__.py`, `main.py`, `schemas.py`, `models.py`, `types.py`, `constants.py` | excluded from coverage (see `backend/pyproject.toml`) | `skip` – validated indirectly through routers/mappers |
| `backend/tests/**` | backend test | see §3 |
| `frontend/src/**/*.{ts,tsx}` except the exclusions below | frontend source | `test` / `update` |
| `frontend/src/design-system/**`, `main.tsx`, `src/test/**`, `*.types.ts`, `types.ts`, `index.ts`, `*.constants.ts`, `queryKeys.ts`, `lib/queryClient.ts` | excluded from coverage (see `frontend/vite.config.ts`) | `skip` |
| `*.stories.tsx`, `*.styles.ts`, `*.variants.ts` | design-system plumbing | `skip` |
| `frontend/src/**/*.test.{ts,tsx}` | frontend test | see §3 |
| `.github/**`, `.claude/**`, `*.md`, `Dockerfile`, `compose.yaml`, lockfiles, configs | infrastructure / docs | `skip` |

Exclusion lists live in the coverage config of each stack – read them if in doubt;
they are the source of truth, not this table.

## 3. Decide

- **`test`** – a source module in scope has no test file (backend: no
  `backend/tests/<same path>/test_<module>.py`; frontend: no sibling `<name>.test.ts(x)`).
- **`update`** – the module has tests but the diff adds or changes behaviour they do
  not exercise: a new function, endpoint, prop, branch, error path or changed
  message. Read the existing tests to check – do not assume. Also `update` when
  the PR changed a test file itself but left new behaviour in the matching source
  untested.
- **`skip`** – excluded path, pure rename/move with tests already following, or a
  cosmetic change (formatting, comments, log messages, type-only edits). Say which.
- **`needs-human`** – the change cannot be unit-tested without touching production
  code (e.g. untestable side effects at import time), the diff looks like it
  contains a bug, or a test the PR modified now asserts behaviour that contradicts
  the source. Explain in "Notes for reviewers".

Deleted source files: if their test file still exists, mark it `needs-human`
(the suite will fail on import; the PR author should delete the test). Never
delete files yourself.

## 4. Size the work

Order targets by value: public behaviour first (endpoints, hooks, exported
functions), then error paths, then edge cases. For each target, write the list of
behaviours you will assert *before* opening the test file – typically 2–6 per
module. If the list for the whole run exceeds ~25 tests, keep the most valuable
ones and mention the rest under "Notes for reviewers".

## Output of this step

A decisions table (file, decision, reason) that goes verbatim into the report, and
a working list of targets with their planned behaviours. Only then move on to the
`backend-unit-tests` / `frontend-unit-tests` skills.
