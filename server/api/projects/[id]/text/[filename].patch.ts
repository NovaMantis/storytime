import { basename, join } from 'node:path'
import { existsSync } from 'node:fs'
import { getDb } from '../../../../utils/db'
import { writeExtractedText } from '../../../../utils/textExtractor'
import { AppError, throwAppError } from '../../../../utils/errors'
import type { ProjectRow } from '../../../../utils/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const filename = getRouterParam(event, 'filename')
  if (!id || !filename) {
    throwAppError(new AppError('INVALID_PARAMS', 'Project id and filename are required.', 400))
  }

  const decoded = decodeURIComponent(filename)
  const safeFilename = basename(decoded)
  if (safeFilename !== decoded) {
    throwAppError(new AppError('INVALID_FILENAME', 'Invalid filename.', 400))
  }

  const body = await readBody<{ text?: string }>(event)
  if (typeof body.text !== 'string') {
    throwAppError(new AppError('INVALID_BODY', 'Text is required.', 400))
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) {
    throwAppError(new AppError('NOT_FOUND', 'Project not found.', 404))
  }

  const processedPath = join(project.folder_path, 'processed', safeFilename)
  if (!existsSync(processedPath)) {
    throwAppError(new AppError('NOT_FOUND', 'Processed image not found.', 404))
  }

  writeExtractedText(project.folder_path, safeFilename, body.text)

  const updatedAt = new Date().toISOString()
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(updatedAt, project.id)

  return {
    filename: safeFilename,
    text: body.text,
    updatedAt
  }
})
