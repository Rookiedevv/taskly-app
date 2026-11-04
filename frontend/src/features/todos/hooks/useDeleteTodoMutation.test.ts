import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createQueryClientWrapper } from '../../../test/queryClientWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { Todo } from '../types'
import { useDeleteTodoMutation } from './useDeleteTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { remove: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('removes the deleted task from the cached list', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  const other: Todo = { ...todoFixture, id: 8 }
  client.setQueryData<Todo[]>(todoKeys.list, [todoFixture, other])
  vi.mocked(todosApi.remove).mockResolvedValue(undefined)
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await result.current.mutateAsync(todoFixture.id)
  expect(todosApi.remove).toHaveBeenCalledTimes(1)
  expect(todosApi.remove).toHaveBeenCalledWith(todoFixture.id)
  expect(client.getQueryData(todoKeys.list)).toEqual([other])
})

it('keeps the task cached when the API call fails', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  client.setQueryData<Todo[]>(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.remove).mockRejectedValue(new Error('Task not found.'))
  const { result } = renderHook(() => useDeleteTodoMutation(), { wrapper })
  await expect(result.current.mutateAsync(todoFixture.id)).rejects.toThrow(
    'Task not found.',
  )
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
