import { finalizeProjectImages } from '../../../utils/processPipeline'
import { AppError, throwAppError } from '../../../utils/errors'
import { getRequestAbortSignal } from '../../../utils/requestAbort'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Project id is required.', 400))
  }

  const body = await readBody<{ aiFilenames?: string[], textFilenames?: string[] }>(event)
  const aiFilenames = Array.isArray(body?.aiFilenames) ? body.aiFilenames : []
  const textFilenames = Array.isArray(body?.textFilenames) ? body.textFilenames : []
  const signal = getRequestAbortSignal(event)

  try {
    return await finalizeProjectImages(id, { aiFilenames, textFilenames }, { signal })
  } catch (err) {
    if (err instanceof AppError) {
      throwAppError(err)
    }
    throwAppError(new AppError(
      'FINALIZE_FAILED',
      err instanceof Error ? err.message : String(err),
      500
    ))
  }
})
