import { preprocessEmails } from '../../utils/processPipeline'
import { AppError, throwAppError } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ emailIds?: string[] }>(event)
  if (!body?.emailIds?.length) {
    throwAppError(new AppError('INVALID_BODY', 'emailIds array is required.', 400))
  }

  try {
    return await preprocessEmails(body.emailIds)
  } catch (err) {
    if (err instanceof AppError) {
      throwAppError(err)
    }
    throwAppError(new AppError(
      'PROCESS_FAILED',
      err instanceof Error ? err.message : String(err),
      500
    ))
  }
})
