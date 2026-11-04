from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from starlette.requests import Request

from app.api.dependencies import get_repository
from app.features.todos.repository import TodoRepository


def test_session_creation_failure_propagates_from_repository_dependency():
    session_factory = Mock(side_effect=RuntimeError("Session unavailable"))
    app = SimpleNamespace(state=SimpleNamespace(session_factory=session_factory))
    request = Request({"type": "http", "app": app})
    dependency = get_repository(request)
    with pytest.raises(RuntimeError, match="Session unavailable"):
        next(dependency)
    session_factory.assert_called_once_with()


def make_request(session):
    session_factory = Mock(return_value=session)
    app = SimpleNamespace(state=SimpleNamespace(session_factory=session_factory))
    return Request({"type": "http", "app": app}), session_factory


def test_repository_dependency_wraps_a_fresh_session_and_closes_it_afterwards():
    session = Mock(name="session")
    request, session_factory = make_request(session)
    dependency = get_repository(request)
    repository = next(dependency)
    assert isinstance(repository, TodoRepository)
    assert repository.session is session
    session_factory.assert_called_once_with()
    session.close.assert_not_called()
    dependency.close()
    session.close.assert_called_once_with()
    session.rollback.assert_not_called()


def test_repository_dependency_rolls_back_and_closes_when_the_request_fails():
    session = Mock(name="session")
    request, _ = make_request(session)
    dependency = get_repository(request)
    next(dependency)
    with pytest.raises(RuntimeError, match="handler exploded"):
        dependency.throw(RuntimeError("handler exploded"))
    session.rollback.assert_called_once_with()
    session.close.assert_called_once_with()
