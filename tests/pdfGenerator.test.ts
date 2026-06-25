import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { generateProjectPdf } from '../server/utils/pdfGenerator'

const dirs: string[] = []

async function tempProjectWithImages(count = 2) {
  const dir = join(tmpdir(), `storytime-pdf-${Date.now()}`)
  const processed = join(dir, 'processed')
  mkdirSync(processed, { recursive: true })
  dirs.push(dir)

  for (let i = 0; i < count; i++) {
    const buf = await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: { r: 50 * i, g: 100, b: 150 }
      }
    }).png().toBuffer()
    writeFileSync(join(processed, `page-${i + 1}.png`), buf)
  }

  return {
    dir,
    order: Array.from({ length: count }, (_, i) => `page-${i + 1}.png`)
  }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('generateProjectPdf', () => {
  it('creates a PDF with one page per image', async () => {
    const { dir, order } = await tempProjectWithImages(2)
    const pdfPath = await generateProjectPdf(dir, order)
    const bytes = readFileSync(pdfPath)
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
    expect(bytes.length).toBeGreaterThan(100)
  })

  it('throws when no images exist', async () => {
    const dir = join(tmpdir(), `storytime-empty-${Date.now()}`)
    mkdirSync(join(dir, 'processed'), { recursive: true })
    dirs.push(dir)
    await expect(generateProjectPdf(dir, ['missing.jpg'])).rejects.toThrow()
  })
})
