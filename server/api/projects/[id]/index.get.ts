import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../../../utils/db'
import { readProjectMarkdown } from '../../../utils/projectMarkdown'
import { getThumbnailFilename } from '../../../utils/thumbnails'
import { AppError, throwAppError } from '../../../utils/errors'
import type { ProjectRow } from '../../../utils/types'

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

  let notes = ''
  try {
    notes = readProjectMarkdown(project.folder_path).body
  } catch {
    notes = ''
  }

  const imageOrder: string[] = JSON.parse(project.image_order || '[]')
  const thumbnails = imageOrder.map(filename => ({
    filename,
    thumbnailUrl: `/api/projects/${project.id}/thumbnails/${encodeURIComponent(filename)}`,
    hasThumbnail: existsSync(join(project.folder_path, 'thumbnails', getThumbnailFilename(filename)))
  }))

  const pdfPath = join(project.folder_path, 'output.pdf')
  const hasPdf = existsSync(pdfPath)

  return {
    id: project.id,
    senderEmail: project.sender_email,
    status: project.status,
    notes,
    imageOrder,
    thumbnails,
    hasPdf,
    pdfUrl: hasPdf ? `/api/projects/${project.id}/pdf` : null,
    updatedAt: project.updated_at
  }
})
