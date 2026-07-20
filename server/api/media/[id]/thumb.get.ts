import { createReadStream, existsSync } from 'node:fs'
import { AppError, throwAppError } from '../../../utils/errors'
import {
  getMediaItem,
  getMediaThumbPath
} from '../../../utils/mediaLibrary'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Media id is required.', 400))
  }

  const item = getMediaItem(id)
  if (!item) {
    throwAppError(new AppError('NOT_FOUND', 'Media item not found.', 404))
  }

  const thumbPath = getMediaThumbPath(item)
  if (!existsSync(thumbPath)) {
    throwAppError(new AppError('NOT_FOUND', 'Media thumbnail not found.', 404))
  }

  setHeader(event, 'Content-Type', 'image/jpeg')
  return sendStream(event, createReadStream(thumbPath))
})
