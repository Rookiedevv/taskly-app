import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { request } from './http'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

it('prefixes the path with /api and merges the JSON content type into the headers', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ id: 1 }, 201))
  await expect(
    request('/todos', {
      method: 'POST',
      body: '{}',
      headers: { 'X-Request-Id': 'abc' },
    }),
  ).resolves.toEqual({ id: 1 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith('/api/todos', {
    method: 'POST',
    body: '{}',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc' },
  })
})

it('resolves to undefined for a 204 response', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  await expect(request('/todos/7', { method: 'DELETE' })).resolves.toBe(
    undefined,
  )
})

it('turns a network failure into a friendly connection error', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
  await expect(request('/todos')).rejects.toThrow(
    'Cannot connect to the server. Please try again.',
  )
})

it('rethrows the original error when the request was aborted', async () => {
  const controller = new AbortController()
  controller.abort()
  const abortError = new DOMException('Aborted', 'AbortError')
  fetchMock.mockRejectedValue(abortError)
  await expect(request('/todos', { signal: controller.signal })).rejects.toBe(
    abortError,
  )
})

it('explains the validation rules on a 422 response', async () => {
  fetchMock.mockResolvedValue(
    jsonResponse({ detail: [{ loc: ['title'] }] }, 422),
  )
  await expect(request('/todos', { method: 'POST' })).rejects.toThrow(
    'Check the task details: title up to 120 characters, description up to 2000 characters, and a valid due date.',
  )
})

it('passes a string detail from the server through as the error message', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ detail: 'Task not found.' }, 404))
  await expect(request('/todos/404')).rejects.toThrow('Task not found.')
})

it.each([
  [
    'a non-JSON body',
    new Response('<html>Bad gateway</html>', { status: 502 }),
  ],
  ['a non-string detail', jsonResponse({ detail: { code: 500 } }, 500)],
  ['no detail at all', jsonResponse({}, 500)],
])('falls back to a generic message for %s', async (_, response) => {
  fetchMock.mockResolvedValue(response)
  await expect(request('/todos')).rejects.toThrow(
    'The operation failed. Please try again.',
  )
})
