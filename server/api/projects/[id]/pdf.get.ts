import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../../../utils/db'
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

  const pdfPath = join(project.folder_path, 'output.pdf')
  if (!existsSync(pdfPath)) {
    throwAppError(new AppError('NOT_FOUND', 'PDF not found. Generate it first.', 404))
  }

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', 'inline; filename="output.pdf"')
  return sendStream(event, createReadStream(pdfPath))
})
