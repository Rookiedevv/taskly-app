import { describe, expect, it } from 'vitest'
import { formatDate, isOverdue, selectTodos, validateTodo } from './todos'
import type { Todo, TodoInput } from '../types'

const base: Todo = {
  id: 1,
  title: 'Sprint plan',
  description: '',
  priority: 'medium',
  completed: false,
  due_date: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
}

describe('selectTodos', () => {
  it('combines status with a case-insensitive search in the description', () => {
    const matching = { ...base, description: 'Discuss the API' }
    const todos = [
      matching,
      { ...matching, id: 2, completed: true },
      { ...base, id: 3 },
    ]
    expect(selectTodos(todos, 'active', ' api ', 'newest')).toEqual([matching])
  })

  it('sorts by priority without changing the source array', () => {
    const high: Todo = { ...base, id: 2, priority: 'high' }
    const todos = [base, high]
    expect(selectTodos(todos, 'all', '', 'priority')).toEqual([high, base])
    expect(todos).toEqual([base, high])
  })
})

describe('validateTodo', () => {
  const valid: TodoInput = {
    title: 'Sprint plan',
    description: '',
    priority: 'medium',
    due_date: null,
    completed: false,
  }

  it.each([
    ['a blank title', { title: '   ' }, { title: 'Enter a task title.' }],
    [
      'a title over 120 characters',
      { title: 'x'.repeat(121) },
      { title: 'The title must be at most 120 characters.' },
    ],
    [
      'a description over 2000 characters',
      { description: 'y'.repeat(2001) },
      { description: 'The description must be at most 2000 characters.' },
    ],
    [
      'a malformed date',
      { due_date: '2026/10/01' },
      { due_date: 'Enter a valid date.' },
    ],
    [
      'an impossible date',
      { due_date: '2026-02-30' },
      { due_date: 'Enter a valid date.' },
    ],
  ])('reports %s', (_, overrides, expected) => {
    expect(validateTodo({ ...valid, ...overrides })).toEqual(expected)
  })

  it('accepts a trimmed title at the limit and a real due date', () => {
    expect(
      validateTodo({
        ...valid,
        title: ` ${'x'.repeat(120)} `,
        due_date: '2026-12-31',
      }),
    ).toEqual({})
  })
})

describe('selectTodos by due date', () => {
  it('puts tasks without a due date last and breaks ties by newest id', () => {
    const noDate = { ...base, id: 1 }
    const later = { ...base, id: 2, due_date: '2026-12-01' }
    const soon = { ...base, id: 3, due_date: '2026-10-05' }
    const soonTwin = { ...base, id: 4, due_date: '2026-10-05' }
    expect(
      selectTodos([noDate, later, soon, soonTwin], 'all', '', 'due'),
    ).toEqual([soonTwin, soon, later, noDate])
  })
})

describe('isOverdue', () => {
  it('flags only active tasks whose due date is before today', () => {
    expect(isOverdue({ ...base, due_date: '2000-01-01' })).toBe(true)
    expect(
      isOverdue({ ...base, due_date: '2000-01-01', completed: true }),
    ).toBe(false)
    expect(isOverdue({ ...base, due_date: '2999-01-01' })).toBe(false)
    expect(isOverdue({ ...base, due_date: null })).toBe(false)
  })
})

describe('formatDate', () => {
  it('renders an ISO date in a short British format', () => {
    expect(formatDate('2026-10-05')).toBe('5 Oct 2026')
  })
})
