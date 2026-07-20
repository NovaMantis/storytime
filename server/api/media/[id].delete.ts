import { AppError, throwAppError } from '../../utils/errors'
import { deleteMediaItem } from '../../utils/mediaLibrary'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Media id is required.', 400))
  }

  try {
    deleteMediaItem(id)
    return { ok: true }
  } catch (err) {
    if (err instanceof AppError) throwAppError(err)
    throwAppError(new AppError(
      'DELETE_FAILED',
      err instanceof Error ? err.message : String(err),
      500
    ))
  }
})
