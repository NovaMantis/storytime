import { getDb } from '../../utils/db'
import { AppError, throwAppError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ emailIds?: string[], archived?: boolean }>(event)
  if (!body?.emailIds?.length) {
    throwAppError(new AppError('INVALID_BODY', 'emailIds array is required.', 400))
  }

  const archived = body.archived === false ? 0 : 1
  const placeholders = body.emailIds.map(() => '?').join(', ')
  const db = getDb()
  const result = db
    .prepare(`UPDATE emails SET archived = ? WHERE id IN (${placeholders})`)
    .run(archived, ...body.emailIds)

  return { updated: result.changes }
})
