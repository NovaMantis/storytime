import { getDb } from '../../../utils/db'
import { readProjectMarkdown, writeProjectMarkdown } from '../../../utils/projectMarkdown'
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

  const current = readProjectMarkdown(project.folder_path)
  const status = body.status ?? current.frontmatter.status
  const notes = body.notes ?? current.body
  const imageOrder = body.imageOrder ?? JSON.parse(project.image_order || '[]')
  const updatedAt = new Date().toISOString()

  writeProjectMarkdown(
    project.folder_path,
    {
      status,
      imageOrder,
      updatedAt,
      senderEmail: project.sender_email
    },
    notes
  )

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
