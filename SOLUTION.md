# Solution: unit-test agent and agentic PR workflow

This repository extends the Taskly sample app with a custom **test-engineer agent**, four
**reusable skills** it works from, and a **GitHub Actions workflow** that runs the agent on
pull requests, verifies what it wrote, and reports back on the PR.

| Piece | Where |
|---|---|
| Custom agent | `.claude/agents/test-engineer.md` |
| Skills | `.claude/skills/analyze-pr-changes`, `backend-unit-tests`, `frontend-unit-tests`, `verify-tests` (one `SKILL.md` each) |
| Permission rules for the agent | `.claude/settings.json` |
| PR workflow | `.github/workflows/test-agent.yml` (+ `agent_scope.py`, `agent_guard.py`, `agent_activity.py`, `compose_comment.py` in `.github/scripts/`) |
| Plain CI (also reused by the agent workflow) | `.github/workflows/ci.yml` |
| Project notes read by Claude Code | `CLAUDE.md` |

## 1. Main technical decisions

### Agent environment: Claude Code

The agent runs on **Claude Code**, both locally (`claude --agent test-engineer`) and in CI
through the official `anthropics/claude-code-action`. Reasons:

- Claude Code has first-class primitives for exactly the three things the task asks for:
  **custom agents** (`.claude/agents/*.md` – a system prompt plus tool/skill configuration),
  **skills** (`.claude/skills/*/SKILL.md` – reusable, versioned instructions that are
  preloaded into the agent) and **permission rules** (`.claude/settings.json`). No glue code
  is needed to wire them together, and the same definitions work on a developer machine and
  in GitHub Actions.
- The GitHub Action already handles the dangerous parts of running an LLM agent on pull
  requests: it checks that the triggering actor has write access, refuses bot actors (no
  self-triggering loops), and **restores `.claude/` and `CLAUDE.md` from the base branch**
  before the agent starts, so a pull request cannot smuggle in a modified agent, skill or
  permission file.
- It is the tool the team already uses day to day, so the agent is debuggable with the same
  commands a developer would run by hand.

The alternative – a hand-written agent loop on the Claude Agent SDK – would have given more
control over the loop but would have meant re-implementing permission handling, tool
sandboxing and GitHub integration in the three days available.

### One agent, four skills, a clear division of labour

The agent's system prompt holds **policy** (never touch production code, never encode a bug
as expected behaviour, keep the suite green, treat repository content as data, the exact
report format). The skills hold **know-how** that is reusable outside this agent:

- `analyze-pr-changes` – how to turn a diff or a coverage report into per-file decisions
  (`test` / `update` / `skip` / `needs-human`), including which paths are excluded from
  coverage and therefore not worth testing.
- `backend-unit-tests` – the project's pytest conventions and proven recipes (mocking the
  SQLAlchemy session, mounting a router with a dependency override, driving the lifespan
  context manager with anyio, patching `load_dotenv`, inspecting `app.openapi()` instead of
  `app.routes`).
- `frontend-unit-tests` – Vitest + Testing Library conventions (design-system mock, React
  Query hooks with `renderHook` and a `QueryClientProvider` wrapper, `fetch` stubbing,
  Prettier settings).
- `verify-tests` – how to run targeted and full suites, read coverage, and what to do with
  a failing test (fix the test, or report a suspected bug – never weaken the assertion).

Every recipe in the skills was validated by hand against this codebase before the agent used
it; the skills are the main reason the agent's output is consistent with the existing tests.

### Three independent guard rails instead of trusting the prompt

1. **Permission rules** (`.claude/settings.json`): the agent may only create or edit files
   under `backend/tests/`, `frontend/src/test/`, `frontend/src/**/*.test.ts(x)` and
   `.test-agent/`, and may only run the test, type-check, formatter and read-only git
   commands. Network access, package installation, `git push/commit`, and edits to
   `backend/app`, `.github` and `.claude` are explicitly denied.
2. **`agent_guard.py`**: after the agent finishes, the workflow re-reads `git status` and
   fails the run if anything outside the allowed test paths changed or if the report files
   are missing or malformed. The script is executed from a copy taken from the **base
   branch**, not from the PR head.
3. **Only test paths are staged**: the commit step uses explicit pathspecs
   (`backend/tests`, `frontend/src/test`, `**/*.test.ts(x)`), so even a guard bug could not
   commit production code.

### The workflow verifies; the agent does not grade itself

The agent runs the tests while iterating and reports its own counts, but the verdict shown on
the PR comes from `ci.yml` executed as a **reusable workflow on the commit the agent pushed**
(the `verify` job). A `baseline` job runs the same workflow on the commit the PR had before,
so the comment shows before/after test counts and coverage. The verdict is also published as
a **commit status** (`Test agent / verification`) on the agent's commit, because pushes made
with `GITHUB_TOKEN` do not trigger workflows and would otherwise show no checks.

### Cheap gate before the expensive step

The `scope` job classifies the change set with `agent_scope.py` (same rules as the
`analyze-pr-changes` skill). Docs-only, config-only, test-only or excluded-path PRs never
start the agent, so they cost nothing and produce no comment.

### Authentication and triggering

- The agent authenticates to Anthropic with a **Claude subscription OAuth token** stored as
  the `CLAUDE_CODE_OAUTH_TOKEN` secret; an `ANTHROPIC_API_KEY` works equally well (one-line
  change in the workflow).
- GitHub operations use the job's **`GITHUB_TOKEN`** with job-scoped permissions
  (`contents: write`, `pull-requests: write` only in the agent job; `statuses: write` only
  in the report job). No GitHub App installation and no personal access token are needed.
- Pushing with `GITHUB_TOKEN` is deliberate: GitHub does not run workflows for events
  created by that token, so the agent's own commit can never retrigger the agent. The
  `scope` job additionally refuses `github-actions[bot]` as the actor, drafts, fork PRs and
  PRs labelled `skip-test-agent`.

### Two modes of the same workflow

- **`pull_request`** (opened, synchronize, reopened, ready_for_review): analyse the diff
  against the base branch, add or update tests for the changed code, push them to the PR
  branch, comment.
- **`workflow_dispatch`** (coverage sweep): run both suites with coverage, treat every
  under-covered production module as changed, push the tests to a new
  `test-agent/coverage-sweep-<n>` branch and open a pull request with the agent's report as
  its description. An optional `focus` input narrows the sweep.

## 2. How to run the PR workflow

### Prerequisites

1. Repository secret **`CLAUDE_CODE_OAUTH_TOKEN`** (generate with `claude setup-token` on a
   machine where Claude Code is logged in to a Pro/Max/Team account) **or**
   `ANTHROPIC_API_KEY` (then replace the `claude_code_oauth_token:` line in
   `.github/workflows/test-agent.yml` with `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`).
2. GitHub Actions enabled for the repository (default).
3. For the sweep mode only: *Settings → Actions → General → Workflow permissions → "Allow
   GitHub Actions to create and approve pull requests"*, so the workflow can open the sweep
   PR. Without it the branch is still pushed and the compare link is printed in the job
   summary.

Nothing else: dependencies are installed by the workflow (`npm ci`, `pip install -r
requirements.txt`), and Node 22 / Python 3.13 come from the standard setup actions.

### Pull request mode

Open a pull request from a branch **in this repository** (fork PRs are skipped because
GitHub withholds secrets from them). The workflow runs automatically:

1. `Decide whether to run` – classifies the changed files; the result is in the job summary.
2. `Baseline tests (before the agent)` and `Run the test-engineer agent` run in parallel.
3. If the agent wrote or updated tests, they are committed to the PR branch as
   `test: add unit tests for the changes in #<n>` and `Verify the committed tests` runs the
   full CI on that commit.
4. `Publish the results on the pull request` posts (or updates) one sticky comment containing
   the agent's report and the independent verification, and sets the commit status on the
   agent's commit.

Opt out for a PR by adding the label `skip-test-agent`, or by keeping it a draft.

### Coverage sweep mode

*Actions → Test agent → Run workflow* (optionally fill in `focus`). The run ends with a new
pull request titled `test: add missing unit tests (coverage sweep)` whose description is
the agent's report, verified by CI like any other PR.

### Locally

```sh
cd frontend && npm ci && cd ../backend && python -m venv .venv && . .venv/bin/activate \
  && python -m pip install -r requirements.txt && cd ..
claude --agent test-engineer
# then, in the session, e.g.:  "Mode: sweep. Follow your workflow and write .test-agent/report.md"
```

`.claude/settings.json` applies locally too, so the agent is confined to test paths on a
developer machine as well.

## 3. Where the agent and skills are defined and how they are used

- **`.claude/agents/test-engineer.md`** – frontmatter declares the tools the agent may use
  (`Read, Glob, Grep, Edit, Write, Bash`) and the skills to preload
  (`skills: analyze-pr-changes, backend-unit-tests, frontend-unit-tests, verify-tests`). The
  body is the system prompt: hard rules, the five-step workflow (scope → analyse → write →
  verify → report) and the exact report format, which the workflow's `agent_guard.py`
  validates.
- **`.claude/skills/*/SKILL.md`** – each skill is a self-contained instruction set with a
  `name`/`description` frontmatter. Preloading puts their content into the agent's context at
  start-up, so every run applies the same conventions; they can also be invoked on their own
  in an interactive Claude Code session (`/analyze-pr-changes`, …) or reused by other agents.
- **In CI** the workflow checks out the PR branch, installs dependencies and calls the
  Claude Code Action with `claude_args: --agent test-engineer --max-turns 80 --allowedTools …`
  (the allow-list, with absolute paths) and a short prompt that carries only the mode, the
  base ref, the head SHA and the PR number (never the PR title or body – those are untrusted
  input the agent reads itself from git). The Action also loads `.claude/settings.json` as
  the project settings source, which is how the deny rules reach the agent.
- The agent leaves two artifacts in `.test-agent/` (ignored by git): `report.md` (posted on
  the PR) and `result.json` (machine-readable summary, uploaded as a workflow artifact).

## 4. Example runs

### Run A – coverage sweep (adding the missing tests to the base application)

The missing unit tests in this repository were produced by the agent in sweep mode, run
with Claude Code against the imported base application before the GitHub workflow existed,
and merged through pull request **#1** (its description is the agent's unedited report).

Agent decisions – 23 modules analysed:

| Decision | Count | Examples |
|---|---|---|
| `test` | 15 | `core/config.py`, `core/lifespan.py`, `api/health.py`, `factory.py`, `lib/http.ts`, six React Query hooks, `AppProviders.tsx`, `TodoEmptyState.tsx` – all at 0 % with no test file |
| `update` | 6 | `repository.py` (40 %), `router.py` (51 %), `dependencies.py` (54 %), `database.py` (78 %), `utils/todos.ts` (56 %), `useNotice.ts` (55 %) |
| `skip` | 4 | `api/todos.ts`, `TodoList.tsx`, `TodosPage.tsx`, `DeleteTodoDialog.tsx` – deferred to stay within the per-run test budget, listed for a follow-up |
| `needs-human` | 0 | – |

Skills used, as recorded by the agent: `analyze-pr-changes` (coverage thresholds and the
exclusion lists chose the modules), `backend-unit-tests` (session mocks, router fixture,
anyio for the lifespan, `app.openapi()` for the factory), `frontend-unit-tests`
(design-system mock, API-module mocks for hooks, `fetch` stub, the new
`src/test/queryClientWrapper.tsx` helper), `verify-tests` (targeted runs, one self-fix –
`sessionmaker.class_` is a `Session` *subclass* – then full suites, `tsc`, Prettier).

Test execution – agent's run, confirmed by CI on the PR:

| | Before | After |
|---|---|---|
| Backend tests | 21 passed | **51 passed**, line coverage 42 % → **100 %** |
| Frontend tests | 18 passed | **55 passed**, statements 46.4 % → **81.5 %**, branches 43.8 % → 75.9 % |
| Type check / Prettier | ✅ | ✅ |

The agent touched 20 test files and no production file; `agent_guard.py` confirmed it.

### Run B – pull request adding a feature (PR #4, workflow run [41822720328](https://github.com/Rookiedevv/taskly-app/actions/runs/41822720328))

Pull request **#4** adds a *Complete all* action: `TodoRepository.complete_all()`,
`POST /api/todos/complete-all`, `todosApi.completeAll`, a `useCompleteAllMutation` hook, a
button in `TodosHeader` and the wiring in `TodosPage`. The author only adjusted the existing
tests enough to keep them compiling (new props, a mocked hook, the new route in the factory
test) – which is exactly the situation the agent is for.

What the workflow did, in order:

1. `scope` classified 11 changed files: 7 production source files → run.
2. `baseline` ran CI on the PR head: backend 51 passed (93.1 % statements), frontend
   55 passed (74.5 % statements).
3. `agent` (32 tool calls, 33 turns, 2 min 10 s of model time) read the diff and the
   neighbouring tests, then recorded these decisions:

   | File | Decision | Reason given by the agent |
   |---|---|---|
   | `repository.py` | test | new `complete_all` had no tests |
   | `router.py` | test | new `POST /complete-all` route had no tests |
   | `schemas.py`, `queryKeys.ts`, `types.ts` | skip | covered through router/hook, constants, types only |
   | `test_factory.py` | skip | already updated in the PR |
   | `api/todos.ts` | update | `completeAll` untested |
   | `useCompleteAllMutation.ts` | test | new hook |
   | `TodosHeader.tsx` | update | PR only passed the new props; button behaviour untested |
   | `TodosPage.tsx` | update | complete-all flow and notices untested |

   It wrote 13 tests across 6 files (one new file), ran the affected files, then both full
   suites, `tsc` and Prettier, and produced the report. Skills used, as it reported them:
   `analyze-pr-changes` (decisions), `backend-unit-tests` (mocked session, `repository_mock`
   fixture – it even asserts the generated `SELECT … WHERE completed IS false` statement),
   `frontend-unit-tests` (API-module mock for the hook, design-system mock for the header,
   hook mocks for the page), `verify-tests`.
4. `agent_guard.py` confirmed only test files changed; the workflow committed them as
   `058964d test: add unit tests for the changes in #4` (author `github-actions[bot]`).
5. `verify` re-ran CI on `058964d`: **backend 55 passed, 100 % statements / branches /
   lines; frontend 64 passed, 83.5 % statements** (branches 71.1 → 78.3 %).
6. `report` posted the sticky comment (agent report + before/after tables) and set the
   commit status `Test agent / verification: success` on `058964d`.

### Run C – coverage sweep from the Actions tab (workflow run [41816289315](https://github.com/Rookiedevv/taskly-app/actions/runs/41816289315))

Triggered with *Run workflow* on `main` after run A had been merged. The agent found the
backend at 100 % and skipped it, picked the three frontend modules with the largest gaps
(`api/todos.ts`, `TodoList.tsx`, `DeleteTodoDialog.tsx`), added 10 tests to their existing
test files, and explicitly left `TodosPage.tsx` for a follow-up in its notes. The workflow
pushed `test-agent/coverage-sweep-10`, opened pull request **#3** with the report as its
description, verified it (frontend 65 passed, **88.7 % statements**, 89.4 % lines) and
commented with the before/after numbers.

### What the live runs changed

The PR workflow was developed against an earlier pull request from the same commits (**#2**,
now closed; it accumulated several close/reopen cycles because reopening a PR is the way to
re-run the workflow with an updated definition). Its first runs failed, and the failures were
instructive enough to record here. The agent behaved correctly – it was denied every write, tried the two shell
work-arounds a careless prompt might have allowed (`cat >>`, `python3 -`), was denied those
too, and then stopped and explained – but three things in the workflow were wrong:

- **Permission patterns were relative to the shell's working directory.** After the agent
  ran `cd frontend/src/features/todos`, `Edit(frontend/src/**/*.test.ts)` no longer matched
  the files it was allowed to edit. The allow-list is now anchored to absolute paths
  (`//<workspace>/…`) in the workflow and to the repository root (`/…`) in
  `.claude/settings.json`. `Write(...)` rules were removed: only `Edit(...)` rules are
  consulted, and they cover every file-editing tool.
- **`upload-artifact` skips hidden directories** by default, so the `.test-agent/` report was
  never uploaded (`include-hidden-files: true`), and the Claude Code Action's restore of
  `.claude/` from the base branch looked like an illegal change to the guard (now ignored).
- **GitHub returned a transient `Internal Server Error` on the push** after an otherwise
  perfect run; the push now retries with backoff.

To make such failures diagnosable without downloading anything, the agent job now prints a
secret-free activity summary (tool calls, result block, every permission denial) to the log
and the job summary (`.github/scripts/agent_activity.py`).

## 5. Assumptions

- Pull requests come from branches in this repository by people with write access. The
  workflow does not run for forks; contributions from forks would need a maintainer to push
  the branch into the repository.
- "Unit tests" means tests that run without a database, browser or network, following the
  conventions already present in the base repository (mocked repository, design-system
  mock, mocked API module).
- A Claude subscription token or API key with enough quota for roughly 10–20 agent minutes
  per pull request is available.
- The base branch (`main`) is trusted: whatever `.claude/` and `.github/scripts/` contain
  there defines the agent's behaviour for every PR.
- Coverage exclusions in `frontend/vite.config.ts` and `backend/pyproject.toml` express the
  team's intent about what is worth unit-testing; the agent respects them rather than
  chasing 100 % everywhere.

## 6. Limitations

- **Non-determinism.** Two runs on the same diff can produce different (both valid) tests.
  The report, the guard and CI make the outcome checkable, not reproducible.
- **Cost and latency.** A PR run takes 5–15 minutes and a meaningful amount of model usage;
  `--max-turns 80` and the 40-minute job timeout are the only caps (there is no per-run
  dollar cap when authenticating with a subscription token).
- **Shared subscription token.** An OAuth token is tied to one person's subscription; for a
  team an API key (or workload identity federation) is the right credential.
- **Pushes do not trigger the regular CI run.** Because the agent pushes with
  `GITHUB_TOKEN`, the standalone `CI` workflow does not run on its commit; the `verify` job
  and the commit status cover that gap, but a human pushing afterwards is what produces the
  next regular CI run.
- **Permission rules are literal.** The allow-list is prefix based and compound commands are
  checked part by part, so the agent occasionally loses a turn to a denied `cat … | head`
  variant (visible in the activity summary). A genuinely new test command needs a rule in
  both `.claude/settings.json` and the workflow's `--allowedTools`; keeping the two lists in
  sync is manual today.
- **Detection of bugs is best-effort.** The agent is told to report rather than encode
  suspicious behaviour, but it decides what is suspicious; a wrong-but-plausible
  implementation can still get a test that pins it.
- **Sweep PR creation** depends on a repository setting (see prerequisites); without it the
  branch is pushed but the PR has to be opened by hand.
- Only Vitest and pytest are supported; the skills are written for this stack.

## 7. What I would change for production

- **Dedicated GitHub App** instead of `GITHUB_TOKEN`: signed, attributable commits, the
  regular CI running on the agent's pushes, and finer permission scoping – while keeping the
  bot-actor guard against loops.
- **API key or workload identity federation** instead of a personal subscription token,
  with per-run budget caps (`--max-budget-usd`) and usage monitoring.
- **Suggestions instead of pushes** as an option: post the tests as a review with
  suggested changes (or a separate PR into the feature branch) for teams that do not want a
  bot committing to their branches; today a label (`skip-test-agent`) is the only control.
- **Mutation testing / assertion-quality checks** (e.g. `mutmut`, Stryker) on the agent's
  tests, so "tests pass" is not the only signal of usefulness.
- **Coverage thresholds as a merge check** (`vitest --coverage.thresholds`, `--cov-fail-under`),
  fed by the baseline/after comparison the workflow already computes.
- **Incremental runs**: skip modules whose tests the PR author already updated adequately
  (the skill already says so; a diff-aware heuristic in `agent_scope.py` would save runs),
  and cache `node_modules`/pip across jobs more aggressively.
- **Evaluation harness** for the agent and skills: a set of historical PRs with expected
  decisions, run on every change to `.claude/` so prompt edits are regression-tested like code.
- **Observability**: keep `result.json` across runs (artifact → dashboard) to track
  decisions, test counts, coverage deltas, run time and cost per PR.
- **Model pinning** (`--model`) and a changelog for the agent/skills, so behaviour changes are
  deliberate and reviewable.
