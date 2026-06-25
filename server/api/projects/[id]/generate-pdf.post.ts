import { getDb } from '../../../utils/db'
import { generateProjectPdf } from '../../../utils/pdfGenerator'
import { AppError, throwAppError } from '../../../utils/errors'
import type { ProjectRow } from '../../../utils/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Project id is required.', 400))
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) {
    throwAppError(new AppError('NOT_FOUND', 'Project not found.', 404))
  }

  const imageOrder: string[] = JSON.parse(project.image_order || '[]')
  try {
    await generateProjectPdf(project.folder_path, imageOrder)
    return {
      ok: true,
      pdfUrl: `/api/projects/${project.id}/pdf`
    }
  } catch (err) {
    if (err instanceof AppError) throwAppError(err)
    throwAppError(new AppError(
      'PDF_FAILED',
      err instanceof Error ? err.message : String(err),
      500
    ))
  }
})
