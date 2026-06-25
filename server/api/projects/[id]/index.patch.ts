import { getDb } from '../../../utils/db'
import { readProjectNotes, writeProjectNotes } from '../../../utils/projectMarkdown'
import { AppError, throwAppError } from '../../../utils/errors'
import type { ProjectRow, ProjectStatus } from '../../../utils/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Project id is required.', 400))
  }

  const body = await readBody<{
    status?: ProjectStatus
    notes?: string
    imageOrder?: string[]
  }>(event)

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) {
    throwAppError(new AppError('NOT_FOUND', 'Project not found.', 404))
  }

  const status = body.status ?? project.status
  const notes = body.notes ?? readProjectNotes(project.folder_path)
  const imageOrder = body.imageOrder ?? JSON.parse(project.image_order || '[]')
  const updatedAt = new Date().toISOString()

  if (body.notes !== undefined) {
    writeProjectNotes(project.folder_path, notes)
  }

  db.prepare('UPDATE projects SET status = ?, image_order = ?, updated_at = ? WHERE id = ?')
    .run(status, JSON.stringify(imageOrder), updatedAt, project.id)

  return {
    id: project.id,
    status,
    notes,
    imageOrder,
    updatedAt
  }
})
