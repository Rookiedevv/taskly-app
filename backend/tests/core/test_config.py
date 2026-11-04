from unittest.mock import patch

import pytest

from app.core.config import resolve_database_url

ENV_VARIABLES = (
    "DATABASE_URL",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_HOST",
    "DB_PORT",
    "POSTGRES_DB",
)


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    # Never let the developer's real .env or shell leak into these tests.
    for name in ENV_VARIABLES:
        monkeypatch.delenv(name, raising=False)
    with patch("app.core.config.load_dotenv") as load_dotenv:
        yield load_dotenv


def test_explicit_argument_wins_over_environment(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://env@db/env")
    assert resolve_database_url("sqlite://explicit") == "sqlite://explicit"


def test_database_url_variable_is_used_when_no_argument_is_given(monkeypatch, clean_environment):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://env@db/env")
    assert resolve_database_url() == "postgresql+psycopg://env@db/env"
    clean_environment.assert_called_once()
    assert clean_environment.call_args.kwargs == {"override": False}


def test_postgres_variables_render_a_url_with_a_visible_password(monkeypatch):
    monkeypatch.setenv("POSTGRES_USER", "taskly")
    monkeypatch.setenv("POSTGRES_PASSWORD", "s3cret")
    monkeypatch.setenv("POSTGRES_HOST", "db.internal")
    monkeypatch.setenv("DB_PORT", "5433")
    monkeypatch.setenv("POSTGRES_DB", "tasks")
    assert resolve_database_url() == "postgresql+psycopg://taskly:s3cret@db.internal:5433/tasks"


def test_missing_postgres_variable_raises_key_error(monkeypatch):
    monkeypatch.setenv("POSTGRES_USER", "taskly")
    monkeypatch.setenv("POSTGRES_PASSWORD", "s3cret")
    monkeypatch.setenv("POSTGRES_HOST", "db.internal")
    monkeypatch.setenv("DB_PORT", "5433")
    with pytest.raises(KeyError, match="POSTGRES_DB"):
        resolve_database_url()
