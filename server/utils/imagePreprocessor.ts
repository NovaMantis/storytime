import sharp from 'sharp'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getProcessedOutputName, listOriginalImages } from './imageProcessor'
import { logError, logInfo } from './logger'

export const OUTPUT_WIDTH = 1024
export const OUTPUT_HEIGHT = 1536

export interface PreprocessFailure {
  file: string
  error: string
}

export interface PreprocessResult {
  preprocessed: string[]
  skipped: string[]
  failed: PreprocessFailure[]
}

export function listPreprocessedImageFiles(folderPath: string): string[] {
  const preprocessedDir = join(folderPath, 'preprocessed')
  if (!existsSync(preprocessedDir)) {
    return []
  }
  return readdirSync(preprocessedDir)
    .filter((f: string) => /\.png$/i.test(f))
    .sort()
}

export async function preprocessSingleImage(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .rotate()
    .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255 }
    })
    .modulate({ brightness: 1.08 })
    .linear(1.08, -(128 * 0.08))
    .png()
    .toFile(outputPath)
}

export async function preprocessProjectImages(projectFolderPath: string): Promise<PreprocessResult> {
  const originalDir = join(projectFolderPath, 'original')
  const preprocessedDir = join(projectFolderPath, 'preprocessed')

  if (!existsSync(originalDir)) {
    throw new Error(`original/ not found in ${projectFolderPath}`)
  }

  const files = listOriginalImages(originalDir)
  mkdirSync(preprocessedDir, { recursive: true })

  const result: PreprocessResult = {
    preprocessed: [],
    skipped: [],
    failed: []
  }

  for (const filename of files) {
    const outputName = getProcessedOutputName(filename)
    const outputPath = join(preprocessedDir, outputName)

    if (existsSync(outputPath)) {
      result.skipped.push(filename)
      continue
    }

    const inputPath = join(originalDir, filename)
    logInfo('Preprocessing image', { filename })

    try {
      await preprocessSingleImage(inputPath, outputPath)
      result.preprocessed.push(outputName)
      logInfo('Image preprocessed successfully', { filename, outputName })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.failed.push({ file: filename, error: message })
      logError('Image preprocessing failed', { filename, error: message })
    }
  }

  return result
}

export function formatPreprocessSummary(result: PreprocessResult): string {
  const parts: string[] = []
  if (result.preprocessed.length) {
    parts.push(`preprocessed ${result.preprocessed.length} image(s)`)
  }
  if (result.skipped.length) {
    parts.push(`skipped ${result.skipped.length} already done`)
  }
  if (result.failed.length) {
    parts.push(`${result.failed.length} failed (${result.failed.map(f => f.file).join(', ')})`)
  }
  return parts.join(', ')
}
