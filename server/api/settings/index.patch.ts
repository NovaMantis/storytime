import { AppError, throwAppError } from '../../utils/errors'
import {
  getImageModel,
  getImagePrompt,
  getTextModel,
  getTextPrompt,
  setImageModel,
  setImagePrompt,
  setTextModel,
  setTextPrompt
} from '../../utils/settings'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    imagePrompt?: string
    imageModel?: string
    textPrompt?: string
    textModel?: string
  }>(event)

  if (body.imagePrompt !== undefined) {
    if (typeof body.imagePrompt !== 'string' || !body.imagePrompt.trim()) {
      throwAppError(new AppError('INVALID_PROMPT', 'Image prompt is required.', 400))
    }
    setImagePrompt(body.imagePrompt)
  }

  if (body.imageModel !== undefined) {
    if (typeof body.imageModel !== 'string' || !body.imageModel.trim()) {
      throwAppError(new AppError('INVALID_MODEL', 'Image model is required.', 400))
    }
    setImageModel(body.imageModel)
  }

  if (body.textPrompt !== undefined) {
    if (typeof body.textPrompt !== 'string' || !body.textPrompt.trim()) {
      throwAppError(new AppError('INVALID_PROMPT', 'Text prompt is required.', 400))
    }
    setTextPrompt(body.textPrompt)
  }

  if (body.textModel !== undefined) {
    if (typeof body.textModel !== 'string' || !body.textModel.trim()) {
      throwAppError(new AppError('INVALID_MODEL', 'Text model is required.', 400))
    }
    setTextModel(body.textModel)
  }

  return {
    imagePrompt: getImagePrompt(),
    imageModel: getImageModel(),
    textPrompt: getTextPrompt(),
    textModel: getTextModel()
  }
})
