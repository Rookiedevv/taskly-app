---
name: frontend-unit-tests
description: Conventions and proven recipes for writing Vitest + Testing Library unit tests in the Taskly React frontend – design-system mocks, React Query hooks with renderHook, fetch stubbing, components and the page. Use when creating or updating any *.test.ts(x) under frontend/src.
---

# Frontend unit tests (React 19 + Vitest + Testing Library)

Tests sit next to the module: `src/lib/http.ts` → `src/lib/http.test.ts`,
`src/features/todos/hooks/useX.ts` → `useX.test.ts`. Shared helpers live in
`src/test/` (`setup.ts` registers jest-dom and `cleanup`; `todoFixture.ts` is the
canonical `Todo`). Run from `frontend/` (`cd frontend && npx vitest run <files>`).

## Project conventions (read two sibling tests first, e.g. `TodoItem.test.tsx` and `todos.test.ts`)

- Import test APIs explicitly: `import { expect, it, vi } from 'vitest'` – the
  repo does not rely on globals. Top-level `it(...)`; `describe` only to group
  several behaviours of one function.
- Prettier settings: no semicolons, single quotes, trailing commas. Run
  `npx prettier --write <files>` after writing.
- **Design system is always mocked** in component tests:
  `vi.mock('<relative>/design-system', () => import('<relative>/design-system/mocks'))`.
  The mocks render native elements, so query by role/label/text
  (`getByRole('button', { name })`, `getByRole('heading', { level: 3 })`,
  `getByTestId('alert')` for `Alert`, `getByRole('dialog', { name })` for `Drawer`).
- Mock module boundaries, not implementation details: API module for hooks
  (`vi.mock('../api/todos', () => ({ todosApi: { create: vi.fn() } }))`), hooks for
  components/pages (see `TodosPage.test.tsx`), `fetch` for `lib/http.ts`.
- `vi.mock` is hoisted – put it at top level; call `vi.clearAllMocks()` in
  `beforeEach` when a module mock is shared between tests.
- User interaction via `userEvent.setup()` and `await user.click(...)`; never
  `fireEvent` unless an event has no user-event equivalent.
- Assert visible behaviour (`toBeVisible`, `toHaveTextContent`, `toBeDisabled`,
  `not.toBeInTheDocument`) and callback calls (`toHaveBeenCalledTimes`,
  `toHaveBeenCalledWith`). Compare object identity with `toBe`, not
  `toHaveBeenCalledWith`, when two instances of the same class are involved.
- Test names are sentences about behaviour: `it('keeps the task cached when the API
  call fails')`.

## Recipes

### React Query hooks (`useMutation` / `useQuery` / `useIsMutating`)
Create the helper `src/test/queryClientWrapper.tsx` if it does not exist:

```tsx
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
}
export function createQueryClientWrapper(client = createTestQueryClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, wrapper: Wrapper }
}
```

Then: seed the cache (`client.setQueryData<Todo[]>(todoKeys.list, [...])`), render
with `renderHook(() => useXMutation(), { wrapper })`, `await result.current.mutateAsync(...)`,
and assert both the API call and `client.getQueryData(todoKeys.list)`. Cover: cache
updated on success, cache untouched on failure (`rejects.toThrow`), behaviour with an
empty cache (`undefined` vs `[]` – read the hook). For queries, `await waitFor(() =>
expect(result.current.isSuccess).toBe(true))`. For `useIsMutating`, start a real
`useMutation` with a deferred promise in the same `renderHook` callback.

### `lib/http.ts` (fetch wrapper)
`vi.stubGlobal('fetch', fetchMock)` in `beforeEach`, `vi.unstubAllGlobals()` in
`afterEach`; build responses with `new Response(JSON.stringify(body), { status })`.
Cover: path prefix + merged headers, 204 → `undefined`, network error message,
abort rethrows the original error, 422 message, `detail` string passthrough,
non-JSON / non-string detail fallback.

### Components
Render with the design-system mock, pass `vi.fn()` callbacks, assert every branch
of the JSX (`hasTodos` true/false, `disabled`, error present/absent) and that the
right callback fires with the right argument. Components that use hooks: mock the
hook module and return the minimal shape cast
`as unknown as ReturnType<typeof useX>` (see `DeleteTodoDialog.test.tsx`).

### Providers / context
Render a probe child that reads the context (`useQueryClient()`, `useTheme()`),
and assert the probe received the expected instance (`toBe`).

### Pure functions (`utils/`)
Table-driven `it.each` with small inline fixtures spread from `todoFixture`;
check that inputs are not mutated when the function sorts or filters.

## Checklist before running
- [ ] Design system mocked in every component test; no snapshot tests.
- [ ] No real timers left running (`vi.useFakeTimers()` + `vi.useRealTimers()` if needed).
- [ ] `npx prettier --write` on the files you touched, then `npm run typecheck`.
- [ ] Each new behaviour from the diff has at least one assertion.
