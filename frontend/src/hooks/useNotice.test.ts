import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useNotice } from './useNotice'

it('starts without a notice and exposes a notification callback', () => {
  const { result } = renderHook(() => useNotice())
  expect(result.current.message).toBe('')
  expect(result.current.notify).toEqual(expect.any(Function))
})

it('shows the latest message and clears it after four seconds', () => {
  vi.useFakeTimers()
  try {
    const { result } = renderHook(() => useNotice())
    act(() => result.current.notify('Task saved.'))
    expect(result.current.message).toBe('Task saved.')
    act(() => vi.advanceTimersByTime(3999))
    expect(result.current.message).toBe('Task saved.')
    act(() => result.current.notify('Task deleted.'))
    act(() => vi.advanceTimersByTime(3999))
    expect(result.current.message).toBe('Task deleted.')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.message).toBe('')
  } finally {
    vi.useRealTimers()
  }
})
