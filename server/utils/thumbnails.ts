import sharp from 'sharp'
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const THUMB_WIDTH = 300

export async function generateThumbnails(folderPath: string, filenames: string[]): Promise<string[]> {
  const processedDir = join(folderPath, 'processed')
  const thumbDir = join(folderPath, 'thumbnails')
  mkdirSync(thumbDir, { recursive: true })

  const generated: string[] = []
  for (const filename of filenames) {
    const source = join(processedDir, filename)
    if (!existsSync(source)) continue
    const thumbName = `thumb-${filename.replace(/\.[^.]+$/, '.jpg')}`
    const dest = join(thumbDir, thumbName)
    await sharp(source)
      .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(dest)
    generated.push(thumbName)
  }
  return generated
}

export function getThumbnailFilename(processedFilename: string): string {
  return `thumb-${processedFilename.replace(/\.[^.]+$/, '.jpg')}`
}
