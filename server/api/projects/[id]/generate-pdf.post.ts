import { getDb } from '../../../utils/db'
import { generateManuscriptPdf } from '../../../utils/pdfGenerator'
import { getOrCreateManuscript, readManuscript } from '../../../utils/manuscript'
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

  try {
    let manuscript = readManuscript(project.folder_path)
    if (!manuscript) {
      const imageOrder: string[] = JSON.parse(project.image_order || '[]')
      manuscript = await getOrCreateManuscript(project.folder_path, imageOrder)
    }
    await generateManuscriptPdf(project.folder_path, manuscript)
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
