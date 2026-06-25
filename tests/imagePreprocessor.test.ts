import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  OUTPUT_HEIGHT,
  OUTPUT_WIDTH,
  formatPreprocessSummary,
  listPreprocessedImageFiles,
  preprocessProjectImages,
  preprocessSingleImage
} from '../server/utils/imagePreprocessor'

describe('imagePreprocessor', () => {
  let projectDir: string
  let fixturePath: string

  beforeEach(async () => {
    projectDir = join(tmpdir(), `storytime-preprocess-${Date.now()}`)
    const originalDir = join(projectDir, 'original')
    mkdirSync(originalDir, { recursive: true })

    fixturePath = join(originalDir, 'drawing.jpg')
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 220, g: 220, b: 220 }
      }
    })
      .jpeg()
      .toFile(fixturePath)
  })

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('writes portrait PNG with letterboxing', async () => {
    const outputPath = join(projectDir, 'out.png')
    await preprocessSingleImage(fixturePath, outputPath)

    const meta = await sharp(outputPath).metadata()
    expect(meta.width).toBe(OUTPUT_WIDTH)
    expect(meta.height).toBe(OUTPUT_HEIGHT)
    expect(meta.format).toBe('png')
  })

  it('preprocesses originals into preprocessed/', async () => {
    const result = await preprocessProjectImages(projectDir)

    expect(result.preprocessed).toEqual(['drawing.png'])
    expect(existsSync(join(projectDir, 'preprocessed', 'drawing.png'))).toBe(true)
  })

  it('skips existing preprocessed files', async () => {
    await preprocessProjectImages(projectDir)
    const outputPath = join(projectDir, 'preprocessed', 'drawing.png')
    const before = readFileSync(outputPath)

    const result = await preprocessProjectImages(projectDir)
    expect(result.skipped).toEqual(['drawing.jpg'])
    expect(readFileSync(outputPath)).toEqual(before)
  })

  it('lists preprocessed PNG files', async () => {
    await preprocessProjectImages(projectDir)
    expect(listPreprocessedImageFiles(projectDir)).toEqual(['drawing.png'])
  })

  it('formats preprocess summary', () => {
    expect(formatPreprocessSummary({
      preprocessed: ['a.png'],
      skipped: ['b.jpg'],
      failed: [{ file: 'c.jpg', error: 'bad' }]
    })).toContain('preprocessed 1')
  })
})
