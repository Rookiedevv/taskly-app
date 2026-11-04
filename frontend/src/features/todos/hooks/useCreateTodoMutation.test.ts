import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createQueryClientWrapper } from '../../../test/queryClientWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { Todo, TodoInput } from '../types'
import { useCreateTodoMutation } from './useCreateTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { create: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

const input: TodoInput = {
  title: 'New task',
  description: '',
  priority: 'low',
  due_date: null,
  completed: false,
}

it('prepends the saved task to the cached list and drops a stale copy of it', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  const stale: Todo = { ...todoFixture, id: 9, title: 'Stale copy' }
  const other: Todo = { ...todoFixture, id: 8 }
  client.setQueryData<Todo[]>(todoKeys.list, [other, stale])
  const saved: Todo = { ...todoFixture, ...input, id: 9 }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await expect(result.current.mutateAsync(input)).resolves.toEqual(saved)
  expect(todosApi.create).toHaveBeenCalledTimes(1)
  expect(todosApi.create).toHaveBeenCalledWith(input)
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('starts a list with the saved task when nothing is cached yet', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  const saved: Todo = { ...todoFixture, ...input, id: 1 }
  vi.mocked(todosApi.create).mockResolvedValue(saved)
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await result.current.mutateAsync(input)
  expect(client.getQueryData(todoKeys.list)).toEqual([saved])
})

it('leaves the cache untouched when the API call fails', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  client.setQueryData<Todo[]>(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.create).mockRejectedValue(new Error('Server down'))
  const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
  await expect(result.current.mutateAsync(input)).rejects.toThrow('Server down')
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
