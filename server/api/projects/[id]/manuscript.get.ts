import { getDb } from '../../../utils/db'
import {
  getOrCreateManuscript,
  originalManuscriptExists
} from '../../../utils/manuscript'
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
  const manuscript = await getOrCreateManuscript(project.folder_path, imageOrder)

  return {
    projectId: project.id,
    manuscript,
    hasOriginal: originalManuscriptExists(project.folder_path),
    imageUrls: Object.fromEntries(
      imageOrder.map(filename => [
        filename,
        `/api/projects/${project.id}/processed/${encodeURIComponent(filename)}`
      ])
    ),
    thumbnailUrls: Object.fromEntries(
      imageOrder.map(filename => [
        filename,
        `/api/projects/${project.id}/thumbnails/${encodeURIComponent(filename)}`
      ])
    )
  }
})
