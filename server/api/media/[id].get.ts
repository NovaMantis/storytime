import { createReadStream, existsSync } from 'node:fs'
import { AppError, throwAppError } from '../../utils/errors'
import {
  getMediaFilePath,
  getMediaItem,
  mimeForMediaItem
} from '../../utils/mediaLibrary'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Media id is required.', 400))
  }

  const item = getMediaItem(id)
  if (!item) {
    throwAppError(new AppError('NOT_FOUND', 'Media item not found.', 404))
  }

  const filePath = getMediaFilePath(item)
  if (!existsSync(filePath)) {
    throwAppError(new AppError('NOT_FOUND', 'Media file missing on disk.', 404))
  }

  setHeader(event, 'Content-Type', mimeForMediaItem(item))
  return sendStream(event, createReadStream(filePath))
})
