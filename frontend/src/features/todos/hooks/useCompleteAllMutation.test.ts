import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createQueryClientWrapper } from '../../../test/queryClientWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import type { Todo } from '../types'
import { useCompleteAllMutation } from './useCompleteAllMutation'

vi.mock('../api/todos', () => ({ todosApi: { completeAll: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('marks cached tasks completed and refetches the list', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  const done: Todo = { ...todoFixture, id: 8, completed: true }
  const active: Todo = { ...todoFixture, completed: false }
  client.setQueryData<Todo[]>(todoKeys.list, [active, done])
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  vi.mocked(todosApi.completeAll).mockResolvedValue({ completed: 1 })
  const { result } = renderHook(() => useCompleteAllMutation(), { wrapper })
  await expect(result.current.mutateAsync()).resolves.toEqual({ completed: 1 })
  expect(client.getQueryData<Todo[]>(todoKeys.list)).toEqual([
    { ...active, completed: true },
    done,
  ])
  expect(invalidate).toHaveBeenCalledWith({ queryKey: todoKeys.list })
})

it('leaves the cache alone when nothing was completed', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  client.setQueryData<Todo[]>(todoKeys.list, [todoFixture])
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  vi.mocked(todosApi.completeAll).mockResolvedValue({ completed: 0 })
  const { result } = renderHook(() => useCompleteAllMutation(), { wrapper })
  await result.current.mutateAsync()
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
  expect(invalidate).not.toHaveBeenCalled()
})

it('keeps the cache when the API call fails', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  client.setQueryData<Todo[]>(todoKeys.list, [todoFixture])
  vi.mocked(todosApi.completeAll).mockRejectedValue(new Error('Boom'))
  const { result } = renderHook(() => useCompleteAllMutation(), { wrapper })
  await expect(result.current.mutateAsync()).rejects.toThrow('Boom')
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})
