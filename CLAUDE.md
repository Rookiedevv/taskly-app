# Taskly – notes for Claude Code

Full-stack sample app: `frontend/` (React 19 + TypeScript, Vite, Vitest, Testing
Library, styled-components, React Query) and `backend/` (FastAPI, SQLAlchemy 2,
Pydantic 2, pytest). Docker Compose runs Postgres; unit tests never need it.

## Commands

- Frontend (from `frontend/`): `npm ci`, `npx vitest run`, `npx vitest run --coverage`,
  `npm run typecheck`, `npm run format:check`.
- Backend (from `backend/`, venv active): `python -m pip install -r requirements.txt`,
  `python -m pytest -q`, `python -m pytest --cov=app --cov-report=term-missing`.

## Test automation

- Custom agent: `.claude/agents/test-engineer.md` – writes and verifies unit tests, never
  touches production code. Run locally with `claude --agent test-engineer`.
- Skills it uses: `.claude/skills/{analyze-pr-changes,backend-unit-tests,frontend-unit-tests,verify-tests}`.
- Permissions: `.claude/settings.json` restricts edits to test paths and commands to
  test/lint tools.
- Workflows: `.github/workflows/ci.yml` (tests + coverage), `.github/workflows/test-agent.yml`
  (runs the agent on pull requests and on demand for coverage sweeps).
- Design and decisions: `SOLUTION.md`.

## Conventions

- Tests mirror source paths; see the skills above for fixtures, mocks and recipes.
- Coverage exclusions are defined in `frontend/vite.config.ts` and `backend/pyproject.toml`.
