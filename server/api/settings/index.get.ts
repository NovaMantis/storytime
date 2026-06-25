import { getImageModel, getImagePrompt, getTextModel, getTextPrompt } from '../../utils/settings'

export default defineEventHandler(() => {
  return {
    imagePrompt: getImagePrompt(),
    imageModel: getImageModel(),
    textPrompt: getTextPrompt(),
    textModel: getTextModel()
  }
})
