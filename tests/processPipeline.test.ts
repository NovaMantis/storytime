import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getDb, closeDb } from '../server/utils/db'

vi.mock('../server/utils/imap', () => ({
  downloadEmailAttachments: vi.fn(async (_emails, originalDir: string) => {
    writeFileSync(join(originalDir, 'test.jpg'), Buffer.from('fake'))
    return ['test.jpg']
  })
}))

vi.mock('../server/utils/pythonRunner', () => ({
  runPythonScript: vi.fn(async (projectPath: string) => {
    const { copyFileSync, mkdirSync: mkdir } = await import('node:fs')
    const processed = join(projectPath, 'processed')
    mkdir(processed, { recursive: true })
    copyFileSync(join(projectPath, 'original', 'test.jpg'), join(processed, 'test.jpg'))
  })
}))

vi.mock('../server/utils/thumbnails', () => ({
  generateThumbnails: vi.fn(async () => ['thumb-test.jpg']),
  getThumbnailFilename: (name: string) => `thumb-${name.replace(/\.[^.]+$/, '.jpg')}`
}))

describe('processEmails', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-process-${Date.now()}`)
    mkdirSync(join(dataDir, 'projects'), { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    closeDb()
    getDb()
  })

  afterEach(() => {
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
  })

  it('processes emails into a project folder', async () => {
    const db = getDb()
    db.prepare(`
      INSERT INTO emails (
        id, message_id, imap_uid, sender, subject, received_at,
        has_image_attachments, attachment_count, processed, status
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 'pending')
    `).run(
      'email-1',
      'msg-1',
      100,
      'Alice <alice@example.com>',
      'Photos',
      new Date().toISOString()
    )

    const { processEmails } = await import('../server/utils/processPipeline')
    const result = await processEmails(['email-1'])

    expect(result.projectId).toBeTruthy()
    expect(result.imageOrder).toContain('test.jpg')

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.projectId) as {
      folder_path: string
    }
    expect(existsSync(join(project.folder_path, 'original', 'test.jpg'))).toBe(true)
    expect(existsSync(join(project.folder_path, 'processed', 'test.jpg'))).toBe(true)

    const email = db.prepare('SELECT processed, status FROM emails WHERE id = ?').get('email-1') as {
      processed: number
      status: string
    }
    expect(email.processed).toBe(1)
    expect(email.status).toBe('processed')
  })
})
