# Extending Storytime

This guide explains how to add features consistently.

## Adding a new page

1. Create `app/pages/your-page.vue`
2. Add `definePageMeta({ layout: 'admin' })`
3. Use `<AppPageHeader title="..." description="..." />`
4. Add a nav link in `app/layouts/admin.vue`

## Adding an API route

1. Create `server/api/your-route.get.ts` (or `.post.ts`, etc.)
2. Put business logic in `server/utils/`, not in the route file
3. Use `AppError` + `throwAppError()` for errors
4. Return plain JSON (no wrapper unless needed)

Example:

```ts
// server/api/example.get.ts
import { throwAppError, AppError } from '../utils/errors'

export default defineEventHandler(() => {
  throwAppError(new AppError('NOT_READY', 'Example not implemented', 501))
})
```

## Adding a UI component

- Shared components live in `app/components/`
- Prefix with `App` for app-specific components (`AppPageHeader`, `AppStatusBadge`)
- Use Nuxt UI primitives (`UButton`, `UCard`, `UBadge`, etc.)
- Use Tailwind utility classes for layout only

## Calling the API from the UI

Use the `useApi()` composable:

```ts
const { api } = useApi()
const result = await api('/api/inbox/sync', { method: 'POST' })
```

It shows a toast on error automatically.

## Adding a new project status

1. Add the value to `ProjectStatus` in `server/utils/types.ts`
2. Add option in `app/pages/projects/[id].vue` `statusOptions`
3. Update `AppStatusBadge` color mapping if needed
4. Document in `docs/features/projects.md`

## Adding a new inbox filter

1. Add filter value handling in `server/api/inbox/index.get.ts`
2. Add option in `app/pages/inbox.vue` `filterOptions`

## Logging

Use `logInfo()` / `logError()` from `server/utils/logger.ts` for server-side events.

## Tests

Add tests in `tests/` mirroring `server/utils/` structure. Run with `npm test`.
