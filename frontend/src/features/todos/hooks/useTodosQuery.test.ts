import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createQueryClientWrapper } from '../../../test/queryClientWrapper'
import { todoFixture } from '../../../test/todoFixture'
import { todoKeys } from '../api/queryKeys'
import { todosApi } from '../api/todos'
import { useTodosQuery } from './useTodosQuery'

vi.mock('../api/todos', () => ({ todosApi: { list: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('loads the task list under the list key and passes an abort signal', async () => {
  const { client, wrapper } = createQueryClientWrapper()
  vi.mocked(todosApi.list).mockResolvedValue([todoFixture])
  const { result } = renderHook(() => useTodosQuery(), { wrapper })
  expect(result.current.isPending).toBe(true)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data).toEqual([todoFixture])
  expect(todosApi.list).toHaveBeenCalledTimes(1)
  expect(todosApi.list).toHaveBeenCalledWith(expect.any(AbortSignal))
  expect(client.getQueryData(todoKeys.list)).toEqual([todoFixture])
})

it('exposes the API error when loading fails', async () => {
  const { wrapper } = createQueryClientWrapper()
  vi.mocked(todosApi.list).mockRejectedValue(new Error('Cannot connect'))
  const { result } = renderHook(() => useTodosQuery(), { wrapper })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error?.message).toBe('Cannot connect')
  expect(result.current.data).toBeUndefined()
})
