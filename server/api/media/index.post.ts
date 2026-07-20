import { AppError, throwAppError } from '../../utils/errors'
import { saveMediaUpload } from '../../utils/mediaLibrary'

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throwAppError(new AppError('INVALID_UPLOAD', 'No file uploaded.', 400))
  }

  const filePart = form.find(part => part.name === 'file' && part.data?.length)
  if (!filePart?.data) {
    throwAppError(new AppError('INVALID_UPLOAD', 'A file field named "file" is required.', 400))
  }

  try {
    const item = await saveMediaUpload({
      data: Buffer.from(filePart.data),
      originalName: filePart.filename || 'upload',
      mime: filePart.type || ''
    })
    return { ok: true, item }
  } catch (err) {
    if (err instanceof AppError) throwAppError(err)
    throwAppError(new AppError(
      'UPLOAD_FAILED',
      err instanceof Error ? err.message : String(err),
      500
    ))
  }
})
