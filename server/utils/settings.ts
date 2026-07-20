import { getMeta, setMeta } from './db'

export const IMAGE_PROMPT_META_KEY = 'openai_image_prompt'
export const TEXT_PROMPT_META_KEY = 'openai_text_prompt'
export const IMAGE_MODEL_META_KEY = 'openai_image_model'
export const TEXT_MODEL_META_KEY = 'openai_text_model'
export const MANUSCRIPT_DEFAULT_FONT_META_KEY = 'manuscript_default_font'

export const DEFAULT_IMAGE_PROMPT = (
  'please remove the writing, the lines and the dashed line box to just the drawing then enhance and make brighter and make the white background pure white. Ensure that the entire drawing is kept and that it is portrait orientation. (keep in portrait orientation and make sure none of the image is cropped)'
)

export const DEFAULT_TEXT_PROMPT = (
  'Transcribe all handwritten text on this children\'s storybook page. Include the page number, speech bubble captions, and story narrative lines. Ignore printed worksheet labels such as "(page number)". Return plain text only with line breaks preserved. Do not describe the drawing.'
)

export const DEFAULT_IMAGE_MODEL = 'gpt-image-1.5'
export const DEFAULT_TEXT_MODEL = 'gpt-4o'
export const DEFAULT_MANUSCRIPT_FONT = 'Literata'

export function getImagePrompt(): string {
  return getMeta(IMAGE_PROMPT_META_KEY)
    || process.env.OPENAI_IMAGE_PROMPT
    || DEFAULT_IMAGE_PROMPT
}

export function setImagePrompt(prompt: string): void {
  setMeta(IMAGE_PROMPT_META_KEY, prompt.trim())
}

export function initImagePrompt(): void {
  if (!getMeta(IMAGE_PROMPT_META_KEY)) {
    setMeta(IMAGE_PROMPT_META_KEY, process.env.OPENAI_IMAGE_PROMPT || DEFAULT_IMAGE_PROMPT)
  }
}

export function getTextPrompt(): string {
  return getMeta(TEXT_PROMPT_META_KEY)
    || process.env.OPENAI_TEXT_PROMPT
    || DEFAULT_TEXT_PROMPT
}

export function setTextPrompt(prompt: string): void {
  setMeta(TEXT_PROMPT_META_KEY, prompt.trim())
}

export function initTextPrompt(): void {
  if (!getMeta(TEXT_PROMPT_META_KEY)) {
    setMeta(TEXT_PROMPT_META_KEY, process.env.OPENAI_TEXT_PROMPT || DEFAULT_TEXT_PROMPT)
  }
}

export function getImageModel(): string {
  return getMeta(IMAGE_MODEL_META_KEY)
    || process.env.OPENAI_IMAGE_MODEL
    || DEFAULT_IMAGE_MODEL
}

export function setImageModel(model: string): void {
  setMeta(IMAGE_MODEL_META_KEY, model.trim())
}

export function initImageModel(): void {
  if (!getMeta(IMAGE_MODEL_META_KEY)) {
    setMeta(IMAGE_MODEL_META_KEY, process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL)
  }
}

export function getTextModel(): string {
  return getMeta(TEXT_MODEL_META_KEY)
    || process.env.OPENAI_TEXT_MODEL
    || DEFAULT_TEXT_MODEL
}

export function setTextModel(model: string): void {
  setMeta(TEXT_MODEL_META_KEY, model.trim())
}

export function initTextModel(): void {
  if (!getMeta(TEXT_MODEL_META_KEY)) {
    setMeta(TEXT_MODEL_META_KEY, process.env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL)
  }
}

export function getManuscriptDefaultFont(): string {
  return getMeta(MANUSCRIPT_DEFAULT_FONT_META_KEY) || DEFAULT_MANUSCRIPT_FONT
}

export function setManuscriptDefaultFont(font: string): void {
  setMeta(MANUSCRIPT_DEFAULT_FONT_META_KEY, font.trim())
}

export function initManuscriptDefaultFont(): void {
  if (!getMeta(MANUSCRIPT_DEFAULT_FONT_META_KEY)) {
    setMeta(MANUSCRIPT_DEFAULT_FONT_META_KEY, DEFAULT_MANUSCRIPT_FONT)
  }
}
