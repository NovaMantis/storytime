import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractProjectTexts,
  formatTextExtractSummary,
  getTextFilePath,
  readExtractedText,
  type TextExtractResult
} from '../server/utils/textExtractor'
import { closeDb, getDb } from '../server/utils/db'

const mockCreate = vi.fn()

vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>()
  return {
    ...actual,
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } }
    }))
  }
})

describe('textExtractor helpers', () => {
  it('maps processed filename to text file path', () => {
    expect(getTextFilePath('/proj', 'page-1.png')).toBe(join('/proj', 'text', 'page-1.txt'))
  })

  it('formats text extract summary', () => {
    const result: TextExtractResult = {
      extracted: ['a.png'],
      skipped: ['b.png'],
      failed: [{ file: 'c.png', error: 'timeout' }]
    }
    expect(formatTextExtractSummary(result)).toContain('extracted text from 1')
    expect(formatTextExtractSummary(result)).toContain('skipped 1')
    expect(formatTextExtractSummary(result)).toContain('c.png')
  })
})

describe('extractProjectTexts', () => {
  let projectDir: string
  let dataDir: string
  const originalApiKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-text-db-${Date.now()}`)
    mkdirSync(dataDir, { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    closeDb()
    getDb()

    projectDir = join(tmpdir(), `storytime-text-${Date.now()}`)
    const preprocessed = join(projectDir, 'preprocessed')
    mkdirSync(preprocessed, { recursive: true })
    writeFileSync(join(preprocessed, 'page.png'), Buffer.from('fake-png'))
    process.env.OPENAI_API_KEY = 'test-key'
    mockCreate.mockReset()
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'one day Mario was bored' } }]
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

  it('writes text file from OpenAI response', async () => {
    const result = await extractProjectTexts(projectDir, { filenames: ['page.png'] })
    expect(result.extracted).toEqual(['page.png'])
    const textPath = getTextFilePath(projectDir, 'page.png')
    expect(existsSync(textPath)).toBe(true)
    expect(readFileSync(textPath, 'utf8')).toBe('one day Mario was bored')
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('reads extracted text when present', async () => {
    await extractProjectTexts(projectDir, { filenames: ['page.png'] })
    expect(readExtractedText(projectDir, 'page.png')).toBe('one day Mario was bored')
    expect(readExtractedText(projectDir, 'missing.png')).toBeNull()
  })

  it('skips when text file already exists', async () => {
    const textPath = getTextFilePath(projectDir, 'page.png')
    mkdirSync(join(projectDir, 'text'), { recursive: true })
    writeFileSync(textPath, 'existing text')
    const result = await extractProjectTexts(projectDir, { filenames: ['page.png'] })
    expect(result.skipped).toEqual(['page.png'])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('throws when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(extractProjectTexts(projectDir, { filenames: ['page.png'] })).rejects.toMatchObject({
      code: 'OPENAI_NOT_CONFIGURED'
    })
  })

  it('throws when all extractions fail', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))
    await expect(extractProjectTexts(projectDir, { filenames: ['page.png'] })).rejects.toMatchObject({
      code: 'OPENAI_TEXT_FAILED'
    })
  })
})
