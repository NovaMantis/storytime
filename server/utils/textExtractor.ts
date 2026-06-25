import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import OpenAI from 'openai'
import { getOpenAiConfig, getOpenAiTextConfig, isOpenAiConfigured } from './config'
import { AppError } from './errors'
import { logError, logInfo } from './logger'
import { throwIfAborted } from './requestAbort'
import { getImageMimeType } from './imageProcessor'

export interface TextExtractFailure {
  file: string
  error: string
}

export interface TextExtractResult {
  extracted: string[]
  skipped: string[]
  failed: TextExtractFailure[]
}

export interface ExtractProjectTextsOptions {
  filenames?: string[]
  forceOverwrite?: boolean
  signal?: AbortSignal
}

export function getTextFilePath(projectFolderPath: string, processedFilename: string): string {
  const base = basename(processedFilename, extname(processedFilename))
  return join(projectFolderPath, 'text', `${base}.txt`)
}

export function readExtractedText(projectFolderPath: string, processedFilename: string): string | null {
  const textPath = getTextFilePath(projectFolderPath, processedFilename)
  if (!existsSync(textPath)) {
    return null
  }
  return readFileSync(textPath, 'utf8')
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

export async function extractTextFromPreprocessedImage(
  projectFolderPath: string,
  preprocessedFilename: string,
  options?: { forceOverwrite?: boolean }
): Promise<string> {
  const preprocessedDir = join(projectFolderPath, 'preprocessed')
  const textDir = join(projectFolderPath, 'text')
  mkdirSync(textDir, { recursive: true })

  const outputPath = getTextFilePath(projectFolderPath, preprocessedFilename)

  if (existsSync(outputPath) && !options?.forceOverwrite) {
    return preprocessedFilename
  }

  const inputPath = join(preprocessedDir, preprocessedFilename)
  const client = createOpenAiClient()
  const { model, prompt } = getOpenAiTextConfig()

  logInfo('Extracting text with OpenAI', { filename: preprocessedFilename, model })

  const imageBytes = readFileSync(inputPath)
  const mimeType = getImageMimeType(preprocessedFilename)
  const dataUrl = `data:${mimeType};base64,${imageBytes.toString('base64')}`

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ]
  })

  const text = response.choices[0]?.message?.content?.trim()
  if (!text) {
    throw new Error('No text returned from the API')
  }

  writeFileSync(outputPath, text, 'utf8')
  logInfo('Text extracted successfully', { filename: preprocessedFilename })
  return preprocessedFilename
}

export async function extractProjectTexts(
  projectFolderPath: string,
  options?: ExtractProjectTextsOptions
): Promise<TextExtractResult> {
  const preprocessedDir = join(projectFolderPath, 'preprocessed')

  if (!existsSync(preprocessedDir)) {
    throw new AppError('PREPROCESSED_NOT_FOUND', `preprocessed/ not found in ${projectFolderPath}`, 500)
  }

  const allFiles = options?.filenames ?? []
  if (allFiles.length === 0) {
    throw new AppError('NO_IMAGES', 'No preprocessed image files specified for text extraction.', 400)
  }

  const files = allFiles.filter((filename) => existsSync(join(preprocessedDir, filename)))
  if (files.length === 0) {
    throw new AppError('NO_IMAGES', 'No matching preprocessed image files found.', 400)
  }

  mkdirSync(join(projectFolderPath, 'text'), { recursive: true })

  const result: TextExtractResult = {
    extracted: [],
    skipped: [],
    failed: []
  }

  const willAttempt = files.some((filename) => {
    const outputPath = getTextFilePath(projectFolderPath, filename)
    return !existsSync(outputPath) || options?.forceOverwrite
  })

  if (willAttempt) {
    createOpenAiClient()
  }

  for (const filename of files) {
    throwIfAborted(options?.signal)

    const outputPath = getTextFilePath(projectFolderPath, filename)

    if (existsSync(outputPath) && !options?.forceOverwrite) {
      result.skipped.push(filename)
      continue
    }

    try {
      await extractTextFromPreprocessedImage(projectFolderPath, filename, {
        forceOverwrite: options?.forceOverwrite
      })
      result.extracted.push(filename)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.failed.push({ file: filename, error: message })
      logError('Text extraction failed', { filename, error: message })
    }
  }

  const attempted = files.length - result.skipped.length
  if (attempted > 0 && result.extracted.length === 0 && result.failed.length > 0) {
    const summary = result.failed.map(f => `${f.file}: ${f.error}`).join('; ')
    throw new AppError(
      'OPENAI_TEXT_FAILED',
      `All text extraction attempts failed. ${summary}`,
      500,
      { failed: result.failed }
    )
  }

  return result
}

export function formatTextExtractSummary(result: TextExtractResult): string {
  const parts: string[] = []
  if (result.extracted.length) {
    parts.push(`extracted text from ${result.extracted.length} image(s)`)
  }
  if (result.skipped.length) {
    parts.push(`skipped ${result.skipped.length} already done`)
  }
  if (result.failed.length) {
    parts.push(`${result.failed.length} failed (${result.failed.map(f => f.file).join(', ')})`)
  }
  return parts.join(', ')
}
