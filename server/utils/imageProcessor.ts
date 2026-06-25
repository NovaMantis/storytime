import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import OpenAI, { toFile } from 'openai'
import { getOpenAiConfig, isOpenAiConfigured } from './config'
import { AppError } from './errors'
import { logError, logInfo } from './logger'
import { throwIfAborted } from './requestAbort'

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

const EXTENSION_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
}

export function getImageMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return EXTENSION_MIME_TYPES[ext] ?? 'application/octet-stream'
}

export interface ImageProcessFailure {
  file: string
  error: string
}

export interface ImageProcessResult {
  processed: string[]
  skipped: string[]
  failed: ImageProcessFailure[]
}

export interface ProcessProjectImagesOptions {
  filenames?: string[]
  forceOverwrite?: boolean
  signal?: AbortSignal
}

export function listOriginalImages(originalDir: string): string[] {
  if (!existsSync(originalDir)) {
    return []
  }
  return readdirSync(originalDir)
    .filter(f => SUPPORTED_EXTENSIONS.has(extname(f).toLowerCase()))
    .sort()
}

export function getProcessedOutputName(originalFilename: string): string {
  const base = basename(originalFilename, extname(originalFilename))
  return `${base}.png`
}

export function findOriginalForProcessedName(
  processedFilename: string,
  originalDir: string
): string | null {
  const base = basename(processedFilename, extname(processedFilename))
  for (const ext of ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']) {
    const candidate = `${base}${ext}`
    if (existsSync(join(originalDir, candidate))) {
      return candidate
    }
  }
  return null
}

function createOpenAiClient(): OpenAI {
  if (!isOpenAiConfigured()) {
    throw new AppError(
      'OPENAI_NOT_CONFIGURED',
      'OPENAI_API_KEY is not set. Add it to your .env file.',
      500
    )
  }
  const { apiKey } = getOpenAiConfig()
  return new OpenAI({ apiKey })
}

export async function processSingleImageWithAi(
  projectFolderPath: string,
  originalFilename: string,
  options?: { forceOverwrite?: boolean }
): Promise<string> {
  const originalDir = join(projectFolderPath, 'original')
  const processedDir = join(projectFolderPath, 'processed')
  mkdirSync(processedDir, { recursive: true })

  const outputName = getProcessedOutputName(originalFilename)
  const outputPath = join(processedDir, outputName)

  if (existsSync(outputPath) && !options?.forceOverwrite) {
    return outputName
  }

  const inputPath = join(originalDir, originalFilename)
  const client = createOpenAiClient()
  const { model, size, prompt } = getOpenAiConfig()

  logInfo('Processing image with OpenAI', { filename: originalFilename, model })

  const mimeType = getImageMimeType(originalFilename)
  const image = await toFile(readFileSync(inputPath), originalFilename, {
    type: mimeType
  })

  const response = await client.images.edit({
    model,
    image,
    prompt,
    size: size as '1024x1536',
    input_fidelity: 'high',
    output_format: 'png'
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('No image data returned from the API')
  }

  writeFileSync(outputPath, Buffer.from(b64, 'base64'))
  logInfo('Image processed successfully', { filename: originalFilename, outputName })
  return outputName
}

export async function processProjectImages(
  projectFolderPath: string,
  options?: ProcessProjectImagesOptions
): Promise<ImageProcessResult> {
  const originalDir = join(projectFolderPath, 'original')
  const processedDir = join(projectFolderPath, 'processed')

  if (!existsSync(originalDir)) {
    throw new AppError('ORIGINAL_NOT_FOUND', `original/ not found in ${projectFolderPath}`, 500)
  }

  const allFiles = listOriginalImages(originalDir)
  const files = options?.filenames
    ? options.filenames.filter(f => allFiles.includes(f))
    : allFiles

  if (files.length === 0) {
    throw new AppError('NO_IMAGES', 'No supported image files found in original/', 400)
  }

  mkdirSync(processedDir, { recursive: true })

  const result: ImageProcessResult = {
    processed: [],
    skipped: [],
    failed: []
  }

  const willAttempt = files.some((filename) => {
    const outputName = getProcessedOutputName(filename)
    const outputPath = join(processedDir, outputName)
    return !existsSync(outputPath) || options?.forceOverwrite
  })

  if (willAttempt) {
    createOpenAiClient()
  }

  for (const filename of files) {
    throwIfAborted(options?.signal)

    const outputName = getProcessedOutputName(filename)
    const outputPath = join(processedDir, outputName)

    if (existsSync(outputPath) && !options?.forceOverwrite) {
      result.skipped.push(filename)
      continue
    }

    try {
      await processSingleImageWithAi(projectFolderPath, filename, {
        forceOverwrite: options?.forceOverwrite
      })
      result.processed.push(outputName)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.failed.push({ file: filename, error: message })
      logError('Image processing failed', { filename, error: message })
    }
  }

  const attempted = files.length - result.skipped.length
  if (attempted > 0 && result.processed.length === 0 && result.failed.length > 0) {
    const summary = result.failed.map(f => `${f.file}: ${f.error}`).join('; ')
    throw new AppError(
      'OPENAI_PROCESS_FAILED',
      `All image processing attempts failed. ${summary}`,
      500,
      { failed: result.failed }
    )
  }

  return result
}

export function formatProcessSummary(result: ImageProcessResult): string {
  const parts: string[] = []
  if (result.processed.length) {
    parts.push(`processed ${result.processed.length} image(s)`)
  }
  if (result.skipped.length) {
    parts.push(`skipped ${result.skipped.length} already done`)
  }
  if (result.failed.length) {
    parts.push(`${result.failed.length} failed (${result.failed.map(f => f.file).join(', ')})`)
  }
  return parts.join(', ')
}
