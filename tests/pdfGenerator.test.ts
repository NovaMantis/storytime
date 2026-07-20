import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { generateManuscriptPdf } from '../server/utils/pdfGenerator'
import {
  MANUSCRIPT_PAGE_HEIGHT_IN,
  MANUSCRIPT_PAGE_WIDTH_IN,
  writeManuscript,
  type Manuscript
} from '../server/utils/manuscript'

const dirs: string[] = []

async function tempProjectWithManuscript(count = 2) {
  const dir = join(tmpdir(), `storytime-pdf-${Date.now()}`)
  const processed = join(dir, 'processed')
  mkdirSync(processed, { recursive: true })
  dirs.push(dir)

  const filenames: string[] = []
  for (let i = 0; i < count; i++) {
    const filename = `page-${i + 1}.png`
    filenames.push(filename)
    const buf = await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: { r: 50 * i, g: 100, b: 150 }
      }
    }).png().toBuffer()
    writeFileSync(join(processed, filename), buf)
  }

  const manuscript: Manuscript = {
    version: 1,
    pageWidthIn: MANUSCRIPT_PAGE_WIDTH_IN,
    pageHeightIn: MANUSCRIPT_PAGE_HEIGHT_IN,
    defaultFontFamily: 'Literata',
    pages: [
      {
        id: 'p1',
        background: 'white',
        images: [{
          id: 'img1',
          source: 'project',
          filename: filenames[0]!,
          x: 1,
          y: 1,
          width: 6,
          height: 4.8,
          crop: { left: 0, top: 0, width: 1, height: 1 }
        }],
        textBoxes: []
      },
      {
        id: 'p2',
        background: 'white',
        images: [],
        textBoxes: []
      },
      {
        id: 'p3',
        background: 'white',
        images: [],
        textBoxes: [{
          id: 't1',
          text: 'Title',
          x: 1,
          y: 3,
          width: 6,
          height: 2,
          fontFamily: 'Literata',
          fontSizePt: 24,
          align: 'center',
          color: '#000000'
        }]
      }
    ]
  }

  if (filenames[1]) {
    manuscript.pages.push({
      id: 'p4',
      background: 'white',
      images: [{
        id: 'img2',
        source: 'project',
        filename: filenames[1],
        x: 1,
        y: 1,
        width: 6,
        height: 4.8,
        crop: { left: 0.1, top: 0.1, width: 0.8, height: 0.8 }
      }],
      textBoxes: [{
        id: 't2',
        text: 'Story text',
        x: 0.5,
        y: 8.5,
        width: 7,
        height: 1.2,
        fontFamily: 'Literata',
        fontSizePt: 14,
        align: 'center',
        color: '#000000'
      }]
    })
  }

  writeManuscript(dir, manuscript)
  return { dir, manuscript }
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('generateManuscriptPdf', () => {
  it('creates a PDF from manuscript layout', async () => {
    const { dir } = await tempProjectWithManuscript(2)
    const pdfPath = await generateManuscriptPdf(dir)
    const bytes = readFileSync(pdfPath)
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
    expect(bytes.length).toBeGreaterThan(100)
  }, 60_000)

  it('throws when no manuscript exists', async () => {
    const dir = join(tmpdir(), `storytime-empty-${Date.now()}`)
    mkdirSync(join(dir, 'processed'), { recursive: true })
    dirs.push(dir)
    await expect(generateManuscriptPdf(dir)).rejects.toThrow()
  })
})
