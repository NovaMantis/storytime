import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../../../../utils/db'
import { getImageMimeType } from '../../../../utils/imageProcessor'
import { AppError, throwAppError } from '../../../../utils/errors'
import type { ProjectRow } from '../../../../utils/types'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  const filename = getRouterParam(event, 'filename')
  if (!id || !filename) {
    throwAppError(new AppError('INVALID_PARAMS', 'Project id and filename are required.', 400))
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) {
    throwAppError(new AppError('NOT_FOUND', 'Project not found.', 404))
  }

  const decoded = decodeURIComponent(filename)
  const filePath = join(project.folder_path, 'original', decoded)

  if (!existsSync(filePath)) {
    throwAppError(new AppError('NOT_FOUND', 'Original image not found.', 404))
  }

  setHeader(event, 'Content-Type', getImageMimeType(decoded))
  return sendStream(event, createReadStream(filePath))
})
