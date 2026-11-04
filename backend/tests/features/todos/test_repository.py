from datetime import timezone
from unittest.mock import Mock

from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from app.features.todos.models import TodoRecord
from app.features.todos.repository import TodoRepository
from app.features.todos.schemas import Priority, TodoCreate, TodoUpdate


def test_list_maps_models_and_orders_tasks_newest_first(model_factory, todo_values, todo):
    session = Mock(spec=Session)
    session.scalars.return_value = [model_factory(todo_values)]
    assert TodoRepository(session).list() == [todo]
    statement = session.scalars.call_args.args[0]
    expected = select(TodoRecord).order_by(TodoRecord.created_at.desc(), TodoRecord.id.desc())
    assert statement.compare(expected)
    compiled = str(statement.compile(dialect=postgresql.dialect()))
    assert "ORDER BY todos.created_at DESC, todos.id DESC" in compiled


def test_get_returns_none_for_missing_task():
    session = Mock(spec=Session)
    session.get.return_value = None
    assert TodoRepository(session).get(404) is None
    session.get.assert_called_once_with(TodoRecord, 404)


def test_get_maps_an_existing_record(model_factory, todo_values, todo):
    session = Mock(spec=Session)
    session.get.return_value = model_factory(todo_values)
    assert TodoRepository(session).get(7) == todo
    session.get.assert_called_once_with(TodoRecord, 7)


def test_create_persists_a_timestamped_record_and_returns_the_saved_task():
    session = Mock(spec=Session)
    session.refresh.side_effect = lambda record: setattr(record, "id", 42)
    payload = TodoCreate(title="Write tests", priority="high")
    result = TodoRepository(session).create(payload)
    record = session.add.call_args.args[0]
    assert isinstance(record, TodoRecord)
    assert (record.title, record.description, record.priority, record.completed) == (
        "Write tests", "", Priority.high, False
    )
    assert record.created_at == record.updated_at
    assert record.created_at.tzinfo is timezone.utc
    session.commit.assert_called_once_with()
    session.refresh.assert_called_once_with(record)
    assert result.id == 42 and result.title == "Write tests" and result.priority == Priority.high


def test_update_applies_only_the_given_fields_and_bumps_updated_at(
    model_factory, todo_values, todo
):
    session = Mock(spec=Session)
    record = model_factory(todo_values)
    session.get.return_value = record
    result = TodoRepository(session).update(7, TodoUpdate(completed=True))
    assert result is not None
    assert result.completed is True
    assert result.title == todo.title and result.priority == todo.priority
    assert result.created_at == todo.created_at
    assert result.updated_at > todo.updated_at
    assert result.updated_at.tzinfo is timezone.utc
    session.commit.assert_called_once_with()
    session.refresh.assert_called_once_with(record)


def test_update_returns_none_for_missing_task_without_committing():
    session = Mock(spec=Session)
    session.get.return_value = None
    assert TodoRepository(session).update(404, TodoUpdate(title="Gone")) is None
    session.commit.assert_not_called()


def test_delete_removes_an_existing_record(model_factory, todo_values):
    session = Mock(spec=Session)
    record = model_factory(todo_values)
    session.get.return_value = record
    assert TodoRepository(session).delete(7) is True
    session.delete.assert_called_once_with(record)
    session.commit.assert_called_once_with()


def test_delete_reports_false_for_missing_task_without_touching_the_session():
    session = Mock(spec=Session)
    session.get.return_value = None
    assert TodoRepository(session).delete(404) is False
    session.delete.assert_not_called()
    session.commit.assert_not_called()


def test_complete_all_marks_active_tasks_completed_and_returns_the_count(
    model_factory, todo_values
):
    session = Mock(spec=Session)
    first = model_factory(todo_values)
    second = model_factory(dict(todo_values, id=8))
    session.scalars.return_value = [first, second]
    assert TodoRepository(session).complete_all() == 2
    assert first.completed is True and second.completed is True
    assert first.updated_at > todo_values["updated_at"]
    assert first.updated_at.tzinfo is timezone.utc
    session.commit.assert_called_once_with()
    statement = session.scalars.call_args.args[0]
    assert statement.compare(select(TodoRecord).where(TodoRecord.completed.is_(False)))


def test_complete_all_without_active_tasks_returns_zero_without_committing():
    session = Mock(spec=Session)
    session.scalars.return_value = []
    assert TodoRepository(session).complete_all() == 0
    session.commit.assert_not_called()
