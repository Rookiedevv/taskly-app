import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TodosHeader } from './TodosHeader'

vi.mock('../../../design-system', () => import('../../../design-system/mocks'))

it('invokes creation when enabled and blocks it when disabled', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn()
  const { rerender } = render(
    <TodosHeader
      disabled={false}
      activeCount={2}
      onCreate={onCreate}
      onCompleteAll={vi.fn()}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Tasks' })).toBeVisible()
  expect(
    screen.getByText('Create, organize, and complete tasks.'),
  ).toBeVisible()
  const button = screen.getByRole('button', { name: 'New task' })
  await user.click(button)
  expect(onCreate).toHaveBeenCalledTimes(1)
  rerender(
    <TodosHeader
      disabled
      activeCount={2}
      onCreate={onCreate}
      onCompleteAll={vi.fn()}
    />,
  )
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onCreate).toHaveBeenCalledTimes(1)
})

it('completes all active tasks and disables the action when none remain', async () => {
  const user = userEvent.setup()
  const onCompleteAll = vi.fn()
  const { rerender } = render(
    <TodosHeader
      disabled={false}
      activeCount={3}
      onCreate={vi.fn()}
      onCompleteAll={onCompleteAll}
    />,
  )
  await user.click(
    screen.getByRole('button', { name: 'Complete all 3 active tasks' }),
  )
  expect(onCompleteAll).toHaveBeenCalledTimes(1)
  rerender(
    <TodosHeader
      disabled={false}
      activeCount={0}
      onCreate={vi.fn()}
      onCompleteAll={onCompleteAll}
    />,
  )
  const button = screen.getByRole('button', { name: 'Complete all tasks' })
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onCompleteAll).toHaveBeenCalledTimes(1)
})
