from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.api.dependencies import get_repository
from app.api.health import router
from app.features.todos.models import TodoRecord


@pytest.fixture
def health_client(repository_mock):
    repository_mock.session = Mock(name="session")
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_repository] = lambda: repository_mock
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def test_health_probes_the_database_and_reports_ok(health_client, repository_mock):
    response = health_client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    repository_mock.session.execute.assert_called_once()
    statement = repository_mock.session.execute.call_args.args[0]
    assert statement.compare(select(TodoRecord.id).limit(1))
    compiled = str(statement.compile(dialect=postgresql.dialect()))
    assert "SELECT todos.id" in compiled and "LIMIT" in compiled


def test_health_fails_when_the_database_probe_raises(health_client, repository_mock):
    repository_mock.session.execute.side_effect = RuntimeError("connection refused")
    response = health_client.get("/api/health")
    assert response.status_code == 500
    assert "ok" not in response.text
