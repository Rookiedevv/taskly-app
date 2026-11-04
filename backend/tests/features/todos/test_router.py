import pytest

from app.features.todos.schemas import TodoCreate, TodoUpdate


def test_list_returns_tasks_from_repository(client, repository_mock, todo):
    repository_mock.list.return_value = [todo]
    response = client.get("/api/todos")
    assert response.status_code == 200
    assert response.json() == [todo.model_dump(mode="json")]
    repository_mock.list.assert_called_once_with()


def test_create_trims_input_and_returns_created_task(client, repository_mock, todo):
    repository_mock.create.return_value = todo
    response = client.post("/api/todos", json={"title": "  Plan the sprint  ", "priority": "high"})
    assert response.status_code == 201
    assert response.json() == todo.model_dump(mode="json")
    repository_mock.create.assert_called_once_with(
        TodoCreate(title="Plan the sprint", priority="high")
    )


@pytest.mark.parametrize("payload", [
    {"title": "   "},
    {"title": "x" * 121},
    {"title": "Task", "priority": "urgent"},
    {"title": "Task", "due_date": "2026-02-30"},
])
def test_invalid_create_never_calls_repository(client, repository_mock, payload):
    assert client.post("/api/todos", json=payload).status_code == 422
    repository_mock.create.assert_not_called()


def test_get_returns_the_requested_task(client, repository_mock, todo):
    repository_mock.get.return_value = todo
    response = client.get("/api/todos/7")
    assert response.status_code == 200
    assert response.json() == todo.model_dump(mode="json")
    repository_mock.get.assert_called_once_with(7)


def test_get_reports_a_missing_task(client, repository_mock):
    repository_mock.get.return_value = None
    response = client.get("/api/todos/404")
    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found."}


def test_update_forwards_only_the_provided_fields(client, repository_mock, todo):
    updated = todo.model_copy(update={"completed": True})
    repository_mock.update.return_value = updated
    response = client.patch("/api/todos/7", json={"completed": True})
    assert response.status_code == 200
    assert response.json() == updated.model_dump(mode="json")
    repository_mock.update.assert_called_once_with(7, TodoUpdate(completed=True))
    assert repository_mock.update.call_args.args[1].model_fields_set == {"completed"}


def test_update_reports_a_missing_task(client, repository_mock):
    repository_mock.update.return_value = None
    response = client.patch("/api/todos/404", json={"title": "Gone"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found."}


@pytest.mark.parametrize(
    ("deleted", "status", "body"),
    [(True, 204, b""), (False, 404, b'{"detail":"Task not found."}')],
)
def test_delete_reports_the_repository_outcome(client, repository_mock, deleted, status, body):
    repository_mock.delete.return_value = deleted
    response = client.delete("/api/todos/7")
    assert response.status_code == status
    assert response.content == body
    repository_mock.delete.assert_called_once_with(7)


@pytest.mark.parametrize("path", ["/api/todos/0", "/api/todos/-1", "/api/todos/abc"])
def test_invalid_task_id_is_rejected_before_reaching_the_repository(
    client, repository_mock, path
):
    assert client.get(path).status_code == 422
    assert client.patch(path, json={"title": "x"}).status_code == 422
    assert client.delete(path).status_code == 422
    repository_mock.get.assert_not_called()
    repository_mock.update.assert_not_called()
    repository_mock.delete.assert_not_called()
