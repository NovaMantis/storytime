import { getDb } from '../../../../utils/db'
import {
  originalManuscriptExists,
  resetManuscriptToOriginal
} from '../../../../utils/manuscript'
import { AppError, throwAppError } from '../../../../utils/errors'
import type { ProjectRow } from '../../../../utils/types'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Project id is required.', 400))
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) {
    throwAppError(new AppError('NOT_FOUND', 'Project not found.', 404))
  }

  if (!originalManuscriptExists(project.folder_path)) {
    throwAppError(new AppError(
      'NO_ORIGINAL',
      'No original manuscript snapshot exists for this project.',
      404
    ))
  }

  try {
    const manuscript = resetManuscriptToOriginal(project.folder_path)
    return { ok: true, manuscript }
  } catch (err) {
    if (err instanceof AppError) throwAppError(err)
    throwAppError(new AppError(
      'RESET_FAILED',
      err instanceof Error ? err.message : String(err),
      500
    ))
  }
})
