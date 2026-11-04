---
name: verify-tests
description: How to run, read and fix the Taskly test suites (Vitest and pytest) after writing tests – targeted runs while iterating, one full run at the end, coverage reading, and the rules for handling failures. Use before writing the agent report.
---

# Verify tests

A test that was never run does not exist. Verify in two passes: targeted while
fixing, full once at the end. Always run commands from the stack's directory with
`cd <dir> && <command>` – the permission rules allow exactly these commands.

## Commands

| Purpose | Backend (`cd backend && …`) | Frontend (`cd frontend && …`) |
|---|---|---|
| One file / a few files | `python -m pytest tests/core/test_config.py -q` | `npx vitest run src/lib/http.test.ts` |
| Full suite | `python -m pytest -q` | `npx vitest run` |
| Full suite + coverage | `python -m pytest --cov=app --cov-report=term-missing -q` | `npx vitest run --coverage` |
| Type check | – | `npm run typecheck` |
| Formatting | – | `npx prettier --write <files>` then `npm run format:check` |

Dependencies are already installed in CI and in a prepared local checkout; never
install anything. If a command is missing, stop and report it.

## Procedure

1. **Targeted run** of every test file you created or edited. Read the first
   failure only, fix it, re-run. Repeat until the targeted run is green.
2. **Full run** of each stack you touched (and the type check + formatter for the
   frontend). This catches fixtures you broke, duplicate test names and import
   errors elsewhere.
3. **Coverage read-out** (optional for `pr` mode, required for `sweep` mode): run
   with coverage and copy the totals into the report. The frontend prints a
   `Coverage summary` block; pytest prints a `TOTAL` line. Report numbers, do not
   estimate them.
4. Record the exact pass/fail counts in the report and in `result.json`.

## Fixing failures – decision rules

- **The test is wrong** (bad selector, wrong mock shape, async not awaited,
  wrong expected message): fix the test.
- **The test exposes a bug in production code**: do not weaken the assertion and
  do not touch the source. Remove the test if it would otherwise fail, keep the
  behaviour description under "Notes for reviewers" with the file and line, and
  mark the module `needs-human`.
- **Flaky** (passes on re-run): find the cause – usually a missing `await`,
  `waitFor`, or a real timer. Never mark a test skipped to get green.
- **Pre-existing failure unrelated to your change** (it fails on the base branch
  too – check with `git stash`-free reasoning: the failing test file is not one you
  touched and its module is not in the diff): leave it, report it.

## Common pitfalls in this repo

- `renderHook` without the `QueryClientProvider` wrapper → "No QueryClient set".
- Forgetting `vi.mock` of the design system → styled-components theme errors.
- `expect(mock).not.toHaveBeenCalledWith(instance)` is deep equality: use
  `toBe` on `mock.mock.calls[0][0]`.
- Backend async tests need `@pytest.mark.anyio` (anyio ships with Starlette;
  `pytest-asyncio` is **not** installed).
- The shared `client` fixture mounts only the todos router; mount other routers
  yourself.
- FastAPI keeps included routers as `_IncludedRouter` objects – inspect
  `app.openapi()["paths"]`, not `app.routes`.

## Definition of done

- Targeted and full runs green for every touched stack.
- Frontend: `npm run typecheck` and `npm run format:check` pass.
- Report and `result.json` contain the real counts from the last full run.
