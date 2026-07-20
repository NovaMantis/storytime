import { AppError, throwAppError } from '../../utils/errors'
import { pullLatest } from '../../utils/gitUpdate'

export default defineEventHandler(async () => {
  try {
    return await pullLatest()
  } catch (err) {
    if (err instanceof AppError) {
      throwAppError(err)
    }
    throwAppError(new AppError(
      'PULL_FAILED',
      err instanceof Error ? err.message : 'Could not pull latest changes',
      500
    ))
  }
})
