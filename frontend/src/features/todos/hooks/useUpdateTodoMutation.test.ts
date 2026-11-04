import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createQueryClientWrapper } from '../../../test/queryClientWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { Todo } from '../types'
import { useUpdateTodoMutation } from './useUpdateTodoMutation'

vi.mock('../api/todos', () => ({ todosApi: { update: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('replaces only the updated task in the cached list', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  const other: Todo = { ...todoFixture, id: 8 }
  client.setQueryData<Todo[]>(todoKeys.list, [todoFixture, other])
  const saved: Todo = { ...todoFixture, completed: true }
  vi.mocked(todosApi.update).mockResolvedValue(saved)
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await expect(
    result.current.mutateAsync({
      id: todoFixture.id,
      input: { completed: true },
    }),
  ).resolves.toEqual(saved)
  expect(todosApi.update).toHaveBeenCalledWith(todoFixture.id, {
    completed: true,
  })
  expect(client.getQueryData(todoKeys.list)).toEqual([saved, other])
})

it('does not create a list when nothing is cached and keeps it on failure', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  vi.mocked(todosApi.update).mockResolvedValueOnce({
    ...todoFixture,
    completed: true,
  })
  const { result } = renderHook(() => useUpdateTodoMutation(), { wrapper })
  await result.current.mutateAsync({ id: 7, input: { completed: true } })
  expect(client.getQueryData(todoKeys.list)).toBeUndefined()

  client.setQueryData<Todo[]>(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.update).mockRejectedValueOnce(new Error('Conflict'))
  await expect(
    result.current.mutateAsync({ id: 7, input: { title: 'x' } }),
  ).rejects.toThrow('Conflict')
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
