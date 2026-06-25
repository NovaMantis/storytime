import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getProcessedOutputName,
  getImageMimeType,
  listOriginalImages,
  formatProcessSummary,
  type ImageProcessResult
} from '../server/utils/imageProcessor'
import { closeDb, getDb } from '../server/utils/db'

const mockEdit = vi.fn()

vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>()
  return {
    ...actual,
    default: vi.fn().mockImplementation(() => ({
      images: { edit: mockEdit }
    }))
  }
})

describe('imageProcessor helpers', () => {
  it('maps original filename to png output name', () => {
    expect(getProcessedOutputName('photo.jpg')).toBe('photo.png')
    expect(getProcessedOutputName('scan.JPEG')).toBe('scan.png')
  })

  it('maps filename extension to image mime type', () => {
    expect(getImageMimeType('photo.jpg')).toBe('image/jpeg')
    expect(getImageMimeType('processed-ABC.jpeg')).toBe('image/jpeg')
    expect(getImageMimeType('scan.PNG')).toBe('image/png')
  })

  it('formats process summary', () => {
    const result: ImageProcessResult = {
      processed: ['a.png'],
      skipped: ['b.jpg'],
      failed: [{ file: 'c.jpg', error: 'timeout' }]
    }
    expect(formatProcessSummary(result)).toContain('processed 1')
    expect(formatProcessSummary(result)).toContain('skipped 1')
    expect(formatProcessSummary(result)).toContain('c.jpg')
  })
})

describe('processProjectImages', () => {
  let projectDir: string
  let dataDir: string
  const originalApiKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-img-db-${Date.now()}`)
    mkdirSync(dataDir, { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    closeDb()
    getDb()

    projectDir = join(tmpdir(), `storytime-img-${Date.now()}`)
    const original = join(projectDir, 'original')
    const processed = join(projectDir, 'processed')
    mkdirSync(original, { recursive: true })
    mkdirSync(processed, { recursive: true })
    writeFileSync(join(original, 'one.jpg'), Buffer.from('fake-jpeg'))
    process.env.OPENAI_API_KEY = 'test-key'
    mockEdit.mockReset()
    mockEdit.mockResolvedValue({
      data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }]
    })
  })

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true })
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = originalApiKey
    }
  })

  it('lists supported originals only', () => {
    writeFileSync(join(projectDir, 'original', 'notes.txt'), 'nope')
    expect(listOriginalImages(join(projectDir, 'original'))).toEqual(['one.jpg'])
  })

  it('writes processed png from OpenAI response', async () => {
    const { processProjectImages } = await import('../server/utils/imageProcessor')
    const result = await processProjectImages(projectDir)
    expect(result.processed).toEqual(['one.png'])
    expect(existsSync(join(projectDir, 'processed', 'one.png'))).toBe(true)
    expect(mockEdit).toHaveBeenCalledTimes(1)
    const uploaded = mockEdit.mock.calls[0]?.[0]?.image as File
    expect(uploaded.type).toBe('image/jpeg')
  })

  it('skips images already in processed/', async () => {
    writeFileSync(join(projectDir, 'processed', 'one.png'), Buffer.from('existing'))
    const { processProjectImages } = await import('../server/utils/imageProcessor')
    const result = await processProjectImages(projectDir)
    expect(result.skipped).toEqual(['one.jpg'])
    expect(result.processed).toEqual([])
    expect(mockEdit).not.toHaveBeenCalled()
  })

  it('throws when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY
    const { processProjectImages } = await import('../server/utils/imageProcessor')
    await expect(processProjectImages(projectDir)).rejects.toMatchObject({
      code: 'OPENAI_NOT_CONFIGURED'
    })
  })

  it('continues on per-image failure and throws if all fail', async () => {
    writeFileSync(join(projectDir, 'original', 'two.jpg'), Buffer.from('fake'))
    mockEdit
      .mockResolvedValueOnce({ data: [{ b64_json: Buffer.from('ok').toString('base64') }] })
      .mockRejectedValueOnce(new Error('API rate limit'))

    const { processProjectImages } = await import('../server/utils/imageProcessor')
    const result = await processProjectImages(projectDir)
    expect(result.processed).toEqual(['one.png'])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]?.file).toBe('two.jpg')

    mockEdit.mockRejectedValue(new Error('always fails'))
    writeFileSync(join(projectDir, 'original', 'three.jpg'), Buffer.from('x'))
    const { rmSync: rm } = await import('node:fs')
    rm(join(projectDir, 'processed', 'one.png'))
    await expect(processProjectImages(projectDir)).rejects.toMatchObject({
      code: 'OPENAI_PROCESS_FAILED'
    })
  })
})
