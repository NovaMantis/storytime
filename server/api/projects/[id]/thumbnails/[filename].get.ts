import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../../../../utils/db'
import { getThumbnailFilename } from '../../../../utils/thumbnails'
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
  const thumbName = getThumbnailFilename(decoded)
  const thumbPath = join(project.folder_path, 'thumbnails', thumbName)
  const processedPath = join(project.folder_path, 'processed', decoded)
  const filePath = existsSync(thumbPath) ? thumbPath : processedPath

  if (!existsSync(filePath)) {
    throwAppError(new AppError('NOT_FOUND', 'Image not found.', 404))
  }

  const ext = filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  setHeader(event, 'Content-Type', ext)
  return sendStream(event, createReadStream(filePath))
})
