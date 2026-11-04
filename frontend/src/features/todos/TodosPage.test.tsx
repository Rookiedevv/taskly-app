import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { useNotice } from '../../hooks/useNotice'
import { todoFixture } from '../../test/todoFixture'
import { useCompleteAllMutation } from './hooks/useCompleteAllMutation'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodosBusy } from './hooks/useTodosBusy'
import { useTodosQuery } from './hooks/useTodosQuery'
import { useUpdateTodoMutation } from './hooks/useUpdateTodoMutation'
import { TodosPage } from './TodosPage'

vi.mock('../../design-system', () => import('../../design-system/mocks'))
vi.mock('../../hooks/useNotice', () => ({ useNotice: vi.fn() }))
vi.mock('./hooks/useCompleteAllMutation', () => ({
  useCompleteAllMutation: vi.fn(),
}))
vi.mock('./hooks/useTodoFilters', () => ({ useTodoFilters: vi.fn() }))
vi.mock('./hooks/useTodosBusy', () => ({ useTodosBusy: vi.fn() }))
vi.mock('./hooks/useTodosQuery', () => ({ useTodosQuery: vi.fn() }))
vi.mock('./hooks/useUpdateTodoMutation', () => ({
  useUpdateTodoMutation: vi.fn(),
}))
vi.mock('./components/TodosHeader', () => ({
  TodosHeader: ({
    activeCount,
    onCompleteAll,
  }: {
    activeCount: number
    onCompleteAll: () => void
  }) => (
    <>
      <h1>Tasks</h1>
      <button onClick={onCompleteAll}>Complete all ({activeCount})</button>
    </>
  ),
}))
vi.mock('./components/TodoFilters', () => ({ TodoFilters: () => null }))
vi.mock('./components/TodoList', () => ({ TodoList: () => <p>Task list</p> }))
vi.mock('./components/TodoEditor', () => ({ TodoEditor: () => null }))
vi.mock('./components/DeleteTodoDialog', () => ({
  DeleteTodoDialog: () => null,
}))
vi.mock('../../components/SuccessNotice', () => ({ SuccessNotice: () => null }))

function setupCompleteAll(
  completed: boolean[],
  mutateAsync: ReturnType<typeof vi.fn>,
) {
  const notify = vi.fn()
  const todos = completed.map((done, index) => ({
    ...todoFixture,
    id: index + 1,
    completed: done,
  }))
  vi.mocked(useTodosQuery).mockReturnValue({
    data: todos,
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useCompleteAllMutation).mockReturnValue({
    error: null,
    reset: vi.fn(),
    mutateAsync,
  } as unknown as ReturnType<typeof useCompleteAllMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: todos,
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  return notify
}

it.each([
  [[false], 1, 'One task completed. Well done!'],
  [[false, false, true], 2, '2 tasks completed. Well done!'],
])(
  'announces the outcome of completing all tasks',
  async (state, count, text) => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({ completed: count })
    const notify = setupCompleteAll(state, mutateAsync)
    render(<TodosPage />)
    await user.click(screen.getByRole('button', { name: /Complete all/ }))
    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(text)
  },
)

it('does nothing when completing all with no active tasks', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi.fn()
  const notify = setupCompleteAll([true], mutateAsync)
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: 'Complete all (0)' }))
  expect(mutateAsync).not.toHaveBeenCalled()
  expect(notify).not.toHaveBeenCalled()
})

it('stays silent when completing all fails', async () => {
  const user = userEvent.setup()
  const mutateAsync = vi.fn().mockRejectedValue(new Error('Boom'))
  const notify = setupCompleteAll([false], mutateAsync)
  render(<TodosPage />)
  await user.click(screen.getByRole('button', { name: /Complete all/ }))
  expect(mutateAsync).toHaveBeenCalledTimes(1)
  expect(notify).not.toHaveBeenCalled()
})

it('displays a query failure and resets mutation errors before retrying', async () => {
  const user = userEvent.setup()
  const refetch = vi.fn().mockResolvedValue(undefined)
  const reset = vi.fn()
  vi.mocked(useTodosQuery).mockReturnValue({
    data: [],
    isPending: false,
    isFetching: false,
    isError: true,
    error: new Error('The server is unavailable.'),
    refetch,
  } as unknown as ReturnType<typeof useTodosQuery>)
  vi.mocked(useUpdateTodoMutation).mockReturnValue({
    error: null,
    reset,
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdateTodoMutation>)
  vi.mocked(useCompleteAllMutation).mockReturnValue({
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCompleteAllMutation>)
  vi.mocked(useTodosBusy).mockReturnValue(false)
  vi.mocked(useNotice).mockReturnValue({ message: '', notify: vi.fn() })
  vi.mocked(useTodoFilters).mockReturnValue({
    filter: 'all',
    search: '',
    sort: 'newest',
    visible: [],
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
  })
  render(<TodosPage />)
  expect(screen.getByTestId('alert')).toHaveTextContent(
    'The server is unavailable.',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1))
  expect(reset).toHaveBeenCalledTimes(1)
  expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
    refetch.mock.invocationCallOrder[0],
  )
})
