import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getDb, closeDb } from '../server/utils/db'

vi.mock('../server/utils/imap', () => ({
  downloadEmailAttachments: vi.fn(async (_emails, originalDir: string) => {
    writeFileSync(join(originalDir, 'test.jpg'), Buffer.from('fake'))
    return ['test.jpg']
  })
}))

vi.mock('../server/utils/imagePreprocessor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/utils/imagePreprocessor')>()
  return {
    ...actual,
    preprocessProjectImages: vi.fn(async (projectPath: string) => {
      const { mkdirSync: mkdir, writeFileSync: write } = await import('node:fs')
      const { join } = await import('node:path')
      const preprocessed = join(projectPath, 'preprocessed')
      mkdir(preprocessed, { recursive: true })
      write(join(preprocessed, 'test.png'), Buffer.from('preprocessed-png'))
      return { preprocessed: ['test.png'], skipped: [], failed: [] }
    }),
    formatPreprocessSummary: vi.fn(() => 'preprocessed 1 image(s)')
  }
})

const mockProcessProjectImages = vi.fn()
const mockExtractProjectTexts = vi.fn()

vi.mock('../server/utils/imageProcessor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/utils/imageProcessor')>()
  return {
    ...actual,
    processProjectImages: (...args: unknown[]) => mockProcessProjectImages(...args),
    formatProcessSummary: vi.fn(() => 'processed 1 image(s)')
  }
})

vi.mock('../server/utils/textExtractor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/utils/textExtractor')>()
  return {
    ...actual,
    extractProjectTexts: (...args: unknown[]) => mockExtractProjectTexts(...args),
    formatTextExtractSummary: vi.fn(() => 'extracted text from 1 image(s)')
  }
})

vi.mock('../server/utils/thumbnails', () => ({
  generateThumbnails: vi.fn(async () => ['thumb-test.jpg']),
  getThumbnailFilename: (name: string) => `thumb-${name.replace(/\.[^.]+$/, '.jpg')}`
}))

describe('preprocessEmails', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-process-${Date.now()}`)
    mkdirSync(join(dataDir, 'projects'), { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    closeDb()
    getDb()
    mockProcessProjectImages.mockReset()
  })

  afterEach(() => {
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
  })

  it('downloads and preprocesses without calling OpenAI', async () => {
    const db = getDb()
    db.prepare(`
      INSERT INTO emails (
        id, message_id, imap_uid, sender, subject, received_at,
        has_image_attachments, attachment_count, processed, status, archived
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 'pending', 0)
    `).run(
      'email-1',
      'msg-1',
      100,
      'Alice <alice@example.com>',
      'Photos',
      new Date().toISOString()
    )

    const { preprocessEmails } = await import('../server/utils/processPipeline')
    const result = await preprocessEmails(['email-1'])

    expect(result.projectId).toBeTruthy()
    expect(result.images).toHaveLength(1)
    expect(mockProcessProjectImages).not.toHaveBeenCalled()

    const email = db.prepare('SELECT processed, status FROM emails WHERE id = ?').get('email-1') as {
      processed: number
      status: string
    }
    expect(email.processed).toBe(0)
    expect(email.status).toBe('awaiting_review')

    const job = db.prepare('SELECT state FROM processing_jobs WHERE project_id = ?').get(result.projectId) as {
      state: string
    }
    expect(job.state).toBe('awaiting_review')
  })
})

describe('finalizeProjectImages', () => {
  let dataDir: string
  let projectId: string
  let folderPath: string

  beforeEach(async () => {
    dataDir = join(tmpdir(), `storytime-finalize-${Date.now()}`)
    mkdirSync(join(dataDir, 'projects'), { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    closeDb()
    const db = getDb()

    folderPath = join(dataDir, 'projects', 'alice-at-example.com')
    mkdirSync(join(folderPath, 'original'), { recursive: true })
    mkdirSync(join(folderPath, 'preprocessed'), { recursive: true })
    writeFileSync(join(folderPath, 'original', 'test.jpg'), Buffer.from('fake'))
    writeFileSync(join(folderPath, 'preprocessed', 'test.png'), Buffer.from('preprocessed-png'))

    projectId = 'project-1'
    db.prepare(`
      INSERT INTO projects (id, sender_email, folder_path, status, image_order, updated_at)
      VALUES (?, ?, ?, 'In review', '[]', ?)
    `).run(projectId, 'alice@example.com', folderPath, new Date().toISOString())

    db.prepare(`
      INSERT INTO processing_jobs (id, project_id, state, started_at)
      VALUES ('job-1', ?, 'awaiting_review', ?)
    `).run(projectId, new Date().toISOString())

    db.prepare(`
      INSERT INTO emails (
        id, message_id, imap_uid, sender, subject, received_at,
        has_image_attachments, attachment_count, processed, status, project_id, archived
      ) VALUES ('email-1', 'msg-1', 1, 'Alice <alice@example.com>', 'Photos', ?, 1, 1, 0, 'awaiting_review', ?, 0)
    `).run(new Date().toISOString(), projectId)

    mockProcessProjectImages.mockReset()
    mockExtractProjectTexts.mockReset()
    mockExtractProjectTexts.mockResolvedValue({ extracted: [], skipped: [], failed: [] })
    mockProcessProjectImages.mockImplementation(async (projectPath: string) => {
      const processed = join(projectPath, 'processed')
      mkdirSync(processed, { recursive: true })
      writeFileSync(join(processed, 'test.png'), Buffer.from('ai-png'))
      return { processed: ['test.png'], skipped: [], failed: [] }
    })
  })

  afterEach(() => {
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
  })

  it('copies preprocessed files when none selected for AI', async () => {
    const { finalizeProjectImages } = await import('../server/utils/processPipeline')
    const result = await finalizeProjectImages(projectId, { aiFilenames: [], textFilenames: [] })

    expect(mockProcessProjectImages).not.toHaveBeenCalled()
    expect(mockExtractProjectTexts).not.toHaveBeenCalled()
    expect(existsSync(join(folderPath, 'processed', 'test.png'))).toBe(true)
    expect(result.imageOrder).toContain('test.png')

    const db = getDb()
    const email = db.prepare('SELECT processed, status FROM emails WHERE id = ?').get('email-1') as {
      processed: number
      status: string
    }
    expect(email.processed).toBe(1)
    expect(email.status).toBe('processed')
  })

  it('calls OpenAI only for selected images', async () => {
    const { finalizeProjectImages } = await import('../server/utils/processPipeline')
    await finalizeProjectImages(projectId, { aiFilenames: ['test.png'], textFilenames: [] })

    expect(mockProcessProjectImages).toHaveBeenCalledWith(
      folderPath,
      expect.objectContaining({ filenames: ['test.jpg'], forceOverwrite: true })
    )
    expect(mockExtractProjectTexts).not.toHaveBeenCalled()
    expect(existsSync(join(folderPath, 'processed', 'test.png'))).toBe(true)
    expect(JSON.parse(readFileSync(join(folderPath, 'ai-processing.json'), 'utf8'))).toEqual({
      aiImageFilenames: ['test.png'],
      aiTextFilenames: []
    })
  })

  it('calls text extraction only for selected images', async () => {
    mockExtractProjectTexts.mockImplementation(async (projectPath: string) => {
      const textDir = join(projectPath, 'text')
      mkdirSync(textDir, { recursive: true })
      writeFileSync(join(textDir, 'test.txt'), 'story text')
      return { extracted: ['test.png'], skipped: [], failed: [] }
    })

    const { finalizeProjectImages } = await import('../server/utils/processPipeline')
    await finalizeProjectImages(projectId, { aiFilenames: [], textFilenames: ['test.png'] })

    expect(mockExtractProjectTexts).toHaveBeenCalledWith(
      folderPath,
      expect.objectContaining({ filenames: ['test.png'], forceOverwrite: true })
    )
    expect(mockProcessProjectImages).not.toHaveBeenCalled()
    expect(existsSync(join(folderPath, 'text', 'test.txt'))).toBe(true)
    expect(existsSync(join(folderPath, 'processed', 'test.png'))).toBe(true)
    expect(JSON.parse(readFileSync(join(folderPath, 'ai-processing.json'), 'utf8'))).toEqual({
      aiImageFilenames: [],
      aiTextFilenames: ['test.png']
    })
  })

  it('runs image and text extraction in parallel when both selected', async () => {
    const { finalizeProjectImages } = await import('../server/utils/processPipeline')
    await finalizeProjectImages(projectId, {
      aiFilenames: ['test.png'],
      textFilenames: ['test.png']
    })

    expect(mockProcessProjectImages).toHaveBeenCalled()
    expect(mockExtractProjectTexts).toHaveBeenCalled()
  })
})
