import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { closeDb, getDb } from '../server/utils/db'
import { createDefaultManuscript, readManuscript } from '../server/utils/manuscript'
import { initManuscriptDefaultFont } from '../server/utils/settings'

const dirs: string[] = []

async function writePng(dir: string, name: string) {
  const buf = await sharp({
    create: {
      width: 300,
      height: 400,
      channels: 3,
      background: { r: 200, g: 200, b: 200 }
    }
  }).png().toBuffer()
  writeFileSync(join(dir, name), buf)
}

describe('createDefaultManuscript', () => {
  let dataDir: string
  let projectDir: string

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-ms-${Date.now()}`)
    projectDir = join(dataDir, 'project')
    mkdirSync(join(projectDir, 'processed'), { recursive: true })
    mkdirSync(join(projectDir, 'text'), { recursive: true })
    dirs.push(dataDir)
    process.env.STORYTIME_DATA_DIR = dataDir
    closeDb()
    getDb()
    initManuscriptDefaultFont()
  })

  afterEach(() => {
    closeDb()
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
    delete process.env.STORYTIME_DATA_DIR
  })

  it('builds image1, blank, title, then remaining images', async () => {
    await writePng(join(projectDir, 'processed'), 'a.png')
    await writePng(join(projectDir, 'processed'), 'b.png')
    await writePng(join(projectDir, 'processed'), 'c.png')
    writeFileSync(join(projectDir, 'text', 'a.txt'), 'Once upon a time')
    writeFileSync(join(projectDir, 'text', 'b.txt'), 'Chapter two')

    const manuscript = await createDefaultManuscript(projectDir, ['a.png', 'b.png', 'c.png'])

    expect(manuscript.pages).toHaveLength(5)
    expect(manuscript.pages[0]!.images?.[0]?.filename).toBe('a.png')
    expect(manuscript.pages[0]!.images?.[0]?.source).toBe('project')
    expect(existsSync(join(projectDir, 'manuscript.original.json'))).toBe(true)
    expect(manuscript.pages[0]!.textBoxes).toHaveLength(0)
    expect(manuscript.pages[1]!.images).toEqual([])
    expect(manuscript.pages[1]!.textBoxes).toHaveLength(0)
    expect(manuscript.pages[2]!.textBoxes[0]!.text).toBe('Once upon a time')
    expect(manuscript.pages[2]!.images).toEqual([])
    expect(manuscript.pages[3]!.images?.[0]?.filename).toBe('b.png')
    expect(manuscript.pages[3]!.textBoxes[0]!.text).toBe('Chapter two')
    expect(manuscript.pages[3]!.textBoxes[0]!.color).toBe('#000000')
    expect(manuscript.pages[0]!.images?.[0]?.crop).toEqual({ left: 0, top: 0, width: 1, height: 1 })
    expect(manuscript.pages[4]!.images?.[0]?.filename).toBe('c.png')
    expect(manuscript.pages[4]!.textBoxes).toHaveLength(0)
    expect(readManuscript(projectDir)?.defaultFontFamily).toBe('Literata')
  })
})
