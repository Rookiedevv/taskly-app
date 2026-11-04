import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { useTheme } from 'styled-components'
import { expect, it, vi } from 'vitest'
import { GlobalStyles, theme } from '../design-system'
import { queryClient } from '../lib/queryClient'
import { AppProviders } from './AppProviders'

vi.mock('../design-system', () => import('../design-system/mocks'))

const seen: { client?: QueryClient; theme?: unknown } = {}

function Probe() {
  seen.client = useQueryClient()
  seen.theme = useTheme()
  return <p>probe</p>
}

it('provides the given query client, the theme and the global styles', () => {
  const client = new QueryClient()
  render(
    <AppProviders client={client}>
      <Probe />
    </AppProviders>,
  )
  expect(screen.getByText('probe')).toBeVisible()
  expect(seen.client).toBe(client)
  expect(seen.theme).toBe(theme)
  expect(GlobalStyles).toHaveBeenCalled()
})

it('falls back to the shared application query client', () => {
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  expect(seen.client).toBe(queryClient)
})
