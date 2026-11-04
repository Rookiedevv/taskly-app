---
name: backend-unit-tests
description: Conventions and proven recipes for writing pytest unit tests in the Taskly FastAPI backend – fixtures, mocking SQLAlchemy sessions, testing routers, dependencies, lifespan, config and the factory without a database. Use when creating or updating anything under backend/tests.
---

# Backend unit tests (FastAPI + SQLAlchemy + pytest)

Tests live in `backend/tests/` mirroring `backend/app/`: `app/core/config.py` →
`tests/core/test_config.py`, `app/features/todos/router.py` →
`tests/features/todos/test_router.py`. Every test directory has an `__init__.py`.
Run from `backend/` (`cd backend && python -m pytest ...`).

## Project conventions (read `backend/tests/conftest.py` and `tests/mocks.py` first)

- **No database.** Tests never connect to Postgres. Repositories are tested with
  `Mock(spec=Session)`; routers with the `client` fixture, which mounts only the
  router under test and overrides `get_repository` with `repository_mock`
  (`create_autospec(TodoRepository, instance=True)`).
- **Shared fixtures:** `repository_mock`, `client`, `todo_values` (dict),
  `todo` (`Todo` schema), `model_factory` (dict → `TodoRecord`). Reuse them; add new
  shared fixtures to `conftest.py` only when two or more test modules need them.
- **Style:** plain functions `def test_<behaviour_in_words>()`, no classes, no
  docstrings unless the setup is surprising; `pytest.mark.parametrize` for input
  tables; one behaviour per test; assert on the mock *calls* as well as the result
  (`assert_called_once_with`, `assert_not_called`).
- **Names describe behaviour, not implementation:**
  `test_invalid_create_never_calls_repository`, not `test_post_422`.
- **Imports:** standard library, then third-party, then `app.…`, then `tests.…`.
- Keep lines ≤ 100 characters; match the existing formatting (double quotes).

## Recipes

### Routers
Use the `client` fixture (already wired to `repository_mock`). Assert status code,
JSON body (`todo.model_dump(mode="json")`) and the repository call. For validation
tests assert the repository was **not** called. 404 paths: make the mock return
`None`/`False` and assert `{"detail": "Task not found."}`. Path validation: ids
≤ 0 must give 422 without touching the repository.

Testing a router that is not mounted by the shared `client` fixture (e.g. health):

```python
@pytest.fixture
def health_client(repository_mock):
    repository_mock.session = Mock(name="session")   # autospec has no attributes set
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_repository] = lambda: repository_mock
    with TestClient(app, raise_server_exceptions=False) as client:  # lets 500s surface as responses
        yield client
```

### Repositories
```python
session = Mock(spec=Session)
session.get.return_value = model_factory(todo_values)
repo = TodoRepository(session)
```
Assert the returned schema equals `todo`, and the session interactions
(`add`, `commit`, `refresh`, `delete`). To check a SQLAlchemy statement, compile it:
`str(stmt.compile(dialect=postgresql.dialect()))` or `stmt.compare(expected)`.
For `create`, capture the record with `session.add.call_args.args[0]` and check its
fields and that `created_at == updated_at` are timezone-aware.

### Dependencies / generator functions
Drive the generator by hand: `gen = get_repository(request); repo = next(gen)`, then
`gen.close()` for the happy path or `gen.throw(RuntimeError(...))` for the failure
path, asserting `session.rollback()` / `session.close()`. Build the request as in
`tests/api/test_dependencies.py` (`Request({"type": "http", "app": app})`).

### Lifespan (async context manager)
Patch the collaborators where they are *used*, not where they are defined, and run
the context manager with the anyio plugin that ships with Starlette:

```python
@pytest.mark.anyio
async def test_...(database):          # fixture patches app.core.lifespan.create_database_engine, initialize, create_session_factory
    app = SimpleNamespace(state=SimpleNamespace(database_url="postgresql+psycopg://x"))
    async with lifespan(app):
        ...
    database.engine.dispose.assert_called_once_with()
```
Cover: happy path (engine created from `app.state.database_url`, schema initialised,
session factory stored), failure during initialisation (engine still disposed,
no session factory), exception inside the context (engine disposed).

### Config
`monkeypatch.delenv` every variable first and patch `app.core.config.load_dotenv`
so the developer's real `.env` never leaks into tests. Cover precedence (explicit
argument > `DATABASE_URL` > `POSTGRES_*`), the rendered URL (password **not** hidden),
and a missing variable raising `KeyError`.

### Factory
Patch `app.factory.resolve_database_url`; check `title`, `version`,
`app.state.database_url` and the call argument. Check mounted endpoints through
`app.openapi()["paths"]` (robust across FastAPI versions – do **not** iterate
`app.routes`). Check the lifespan by patching `app.factory.lifespan` with a fake
`@asynccontextmanager` that records events, then entering `TestClient(app)`.

### Pydantic validation
Use `pytest.raises(ValidationError, match="...")`; the project's custom messages
live in `validators.py`.

## Checklist before running
- [ ] Test file path mirrors the module path, `__init__.py` present in new dirs.
- [ ] No network, no database, no sleeping, no real `.env`.
- [ ] Each test asserts both outcome and collaborator calls where relevant.
- [ ] Error paths covered (404, 422, exceptions) when the module has them.
