import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { todoFixture } from '../../../test/todoFixture'
import type { Todo } from '../types'
import { useTodoFilters } from './useTodoFilters'

const older: Todo = {
  ...todoFixture,
  id: 1,
  created_at: '2026-09-01T12:00:00Z',
}
const done: Todo = {
  ...todoFixture,
  id: 2,
  title: 'Ship release',
  completed: true,
  priority: 'high',
}
const todos = [older, done, todoFixture]

it('starts with all tasks visible, newest first', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  expect(result.current.filter).toBe('all')
  expect(result.current.search).toBe('')
  expect(result.current.sort).toBe('newest')
  expect(result.current.visible).toEqual([todoFixture, done, older])
})

it('recomputes the visible tasks when filter, search and sort change', () => {
  const { result } = renderHook(() => useTodoFilters(todos))
  act(() => result.current.setFilter('completed'))
  expect(result.current.visible).toEqual([done])
  act(() => {
    result.current.setFilter('all')
    result.current.setSearch('DEMO')
  })
  expect(result.current.visible).toEqual([todoFixture, older])
  act(() => {
    result.current.setSearch('')
    result.current.setSort('priority')
  })
  expect(result.current.sort).toBe('priority')
  expect(result.current.visible).toEqual([done, todoFixture, older])
})
