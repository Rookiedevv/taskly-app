from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from app.core.lifespan import lifespan


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def database():
    with (
        patch("app.core.lifespan.create_database_engine") as create_database_engine,
        patch("app.core.lifespan.initialize") as initialize,
        patch("app.core.lifespan.create_session_factory") as create_session_factory,
    ):
        engine = Mock(name="engine")
        create_database_engine.return_value = engine
        yield SimpleNamespace(
            engine=engine,
            create_database_engine=create_database_engine,
            initialize=initialize,
            create_session_factory=create_session_factory,
        )


def make_app():
    return SimpleNamespace(state=SimpleNamespace(database_url="postgresql+psycopg://x"))


@pytest.mark.anyio
async def test_lifespan_initialises_schema_and_stores_session_factory(database):
    app = make_app()
    async with lifespan(app):
        database.create_database_engine.assert_called_once_with("postgresql+psycopg://x")
        database.initialize.assert_called_once_with(database.engine)
        database.create_session_factory.assert_called_once_with(database.engine)
        assert app.state.session_factory is database.create_session_factory.return_value
        database.engine.dispose.assert_not_called()
    database.engine.dispose.assert_called_once_with()


@pytest.mark.anyio
async def test_failed_initialisation_disposes_engine_without_session_factory(database):
    database.initialize.side_effect = RuntimeError("database unreachable")
    app = make_app()
    with pytest.raises(RuntimeError, match="database unreachable"):
        async with lifespan(app):
            pytest.fail("the application body must not run")
    database.create_session_factory.assert_not_called()
    assert not hasattr(app.state, "session_factory")
    database.engine.dispose.assert_called_once_with()


@pytest.mark.anyio
async def test_exception_inside_the_context_still_disposes_engine(database):
    with pytest.raises(ValueError, match="boom"):
        async with lifespan(make_app()):
            raise ValueError("boom")
    database.engine.dispose.assert_called_once_with()
