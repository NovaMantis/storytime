import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface AiProcessingMeta {
  aiImageFilenames: string[]
  aiTextFilenames: string[]
}

function getMetaPath(projectFolderPath: string): string {
  return join(projectFolderPath, 'ai-processing.json')
}

export function writeAiProcessingMeta(
  projectFolderPath: string,
  meta: AiProcessingMeta
): void {
  writeFileSync(getMetaPath(projectFolderPath), JSON.stringify(meta, null, 2), 'utf8')
}

export function readAiProcessingMeta(projectFolderPath: string): AiProcessingMeta | null {
  const path = getMetaPath(projectFolderPath)
  if (!existsSync(path)) {
    return null
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<AiProcessingMeta>
    return {
      aiImageFilenames: Array.isArray(parsed.aiImageFilenames) ? parsed.aiImageFilenames : [],
      aiTextFilenames: Array.isArray(parsed.aiTextFilenames) ? parsed.aiTextFilenames : []
    }
  } catch {
    return null
  }
}

/** True when processed differs from preprocessed (legacy projects without ai-processing.json). */
export function isProcessedDifferentFromPreprocessed(
  projectFolderPath: string,
  filename: string
): boolean {
  const processedPath = join(projectFolderPath, 'processed', filename)
  const preprocessedPath = join(projectFolderPath, 'preprocessed', filename)
  if (!existsSync(processedPath) || !existsSync(preprocessedPath)) {
    return false
  }

  const processed = readFileSync(processedPath)
  const preprocessed = readFileSync(preprocessedPath)
  if (processed.length !== preprocessed.length) {
    return true
  }
  return !processed.equals(preprocessed)
}

export function getAiFlagsForFilename(
  projectFolderPath: string,
  filename: string,
  options: {
    meta?: AiProcessingMeta | null
    hasExtractedText: boolean
  }
): { aiImageEnhanced: boolean, aiTextExtracted: boolean } {
  const meta = options.meta === undefined
    ? readAiProcessingMeta(projectFolderPath)
    : options.meta

  return {
    aiImageEnhanced: meta
      ? meta.aiImageFilenames.includes(filename)
      : isProcessedDifferentFromPreprocessed(projectFolderPath, filename),
    aiTextExtracted: options.hasExtractedText
  }
}
