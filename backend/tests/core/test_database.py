from unittest.mock import Mock, patch

from sqlalchemy.orm import Session

from app.core.database import create_database_engine, create_session_factory, initialize
from app.features.todos.models import Base


def test_engine_uses_the_postgresql_psycopg_driver():
    url = "postgresql+psycopg://taskly:taskly@localhost:5432/taskly"
    engine = create_database_engine(url)
    try:
        assert engine.url.drivername == "postgresql+psycopg"
        assert engine.dialect.name == "postgresql"
        assert engine.dialect.driver == "psycopg"
        assert engine.url.database == "taskly"
    finally:
        engine.dispose()


def test_session_factory_binds_the_engine_and_keeps_objects_usable_after_commit():
    engine = create_database_engine("postgresql+psycopg://taskly:taskly@localhost:5432/taskly")
    try:
        factory = create_session_factory(engine)
        assert issubclass(factory.class_, Session)
        assert factory.kw["bind"] is engine
        assert factory.kw["expire_on_commit"] is False
    finally:
        engine.dispose()


def test_initialize_creates_the_schema_on_the_given_engine():
    engine = Mock(name="engine")
    with patch.object(Base.metadata, "create_all") as create_all:
        initialize(engine)
    create_all.assert_called_once_with(engine)
