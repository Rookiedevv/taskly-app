import { useMutation } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { createQueryClientWrapper } from '../../../test/queryClientWrapper'
import { todoKeys } from '../api/queryKeys'
import { useTodosBusy } from './useTodosBusy'

it('is busy only while a todo mutation is in flight', async () => {
  const { wrapper } = createQueryClientWrapper()
  let finish: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const { result } = renderHook(
    () => ({
      busy: useTodosBusy(),
      mutation: useMutation({
        mutationKey: todoKeys.update,
        mutationFn: () => pending,
      }),
    }),
    { wrapper },
  )
  expect(result.current.busy).toBe(false)
  act(() => result.current.mutation.mutate())
  await waitFor(() => expect(result.current.busy).toBe(true))
  finish()
  await waitFor(() => expect(result.current.busy).toBe(false))
})

it('ignores mutations that do not belong to the todos feature', async () => {
  const { wrapper } = createQueryClientWrapper()
  const { result } = renderHook(
    () => ({
      busy: useTodosBusy(),
      mutation: useMutation({
        mutationKey: ['profile', 'update'],
        mutationFn: () => new Promise<void>(() => {}),
      }),
    }),
    { wrapper },
  )
  act(() => result.current.mutation.mutate())
  await waitFor(() => expect(result.current.mutation.isPending).toBe(true))
  expect(result.current.busy).toBe(false)
})
