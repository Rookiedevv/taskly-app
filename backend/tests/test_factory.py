from contextlib import asynccontextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.factory import create_app


@pytest.fixture
def resolve_database_url():
    with patch("app.factory.resolve_database_url") as resolve:
        resolve.return_value = "postgresql+psycopg://resolved"
        yield resolve


def test_create_app_sets_metadata_database_url_and_mounts_all_routes(resolve_database_url):
    app = create_app("sqlite://explicit")
    assert app.title == "Taskly API"
    assert app.version == "1.0.0"
    assert app.state.database_url == "postgresql+psycopg://resolved"
    resolve_database_url.assert_called_once_with("sqlite://explicit")
    paths = app.openapi()["paths"]
    assert set(paths) == {"/api/health", "/api/todos", "/api/todos/{todo_id}"}
    assert set(paths["/api/todos"]) == {"get", "post"}
    assert set(paths["/api/todos/{todo_id}"]) == {"get", "patch", "delete"}


def test_create_app_runs_the_database_lifespan_on_startup_and_shutdown(resolve_database_url):
    events = []

    @asynccontextmanager
    async def fake_lifespan(app):
        events.append(("startup", app.state.database_url))
        yield
        events.append(("shutdown", app.state.database_url))

    with patch("app.factory.lifespan", fake_lifespan):
        app = create_app()
    resolve_database_url.assert_called_once_with(None)
    with TestClient(app):
        assert events == [("startup", "postgresql+psycopg://resolved")]
    assert events == [
        ("startup", "postgresql+psycopg://resolved"),
        ("shutdown", "postgresql+psycopg://resolved"),
    ]
