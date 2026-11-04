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

it('completes all tasks when active tasks exist', async () => {
  const user = userEvent.setup()
  const onCompleteAll = vi.fn()
  render(
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
})

it('disables completing all when no task is active or the page is busy', () => {
  const props = { onCreate: vi.fn(), onCompleteAll: vi.fn() }
  const { rerender } = render(
    <TodosHeader disabled={false} activeCount={0} {...props} />,
  )
  expect(
    screen.getByRole('button', { name: 'Complete all tasks' }),
  ).toBeDisabled()
  rerender(<TodosHeader disabled activeCount={2} {...props} />)
  expect(
    screen.getByRole('button', { name: 'Complete all 2 active tasks' }),
  ).toBeDisabled()
})
