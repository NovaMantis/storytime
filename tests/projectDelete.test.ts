import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { closeDb, getDb } from '../server/utils/db'
import { deleteProject } from '../server/utils/projectFolders'
import { AppError } from '../server/utils/errors'

describe('deleteProject', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-delete-${Date.now()}`)
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

  it('removes project from database and disk', () => {
    const db = getDb()
    const projectId = randomUUID()
    const folderPath = join(dataDir, 'projects', 'alice-example-com')
    mkdirSync(join(folderPath, 'processed'), { recursive: true })
    writeFileSync(join(folderPath, 'project.md'), '# Notes')
    writeFileSync(join(folderPath, 'processed', 'image.jpg'), 'fake')

    db.prepare(`
      INSERT INTO projects (id, sender_email, folder_path, status, image_order, updated_at)
      VALUES (?, ?, ?, 'In review', '[]', ?)
    `).run(projectId, 'alice@example.com', folderPath, new Date().toISOString())

    const result = deleteProject(projectId)

    expect(result.id).toBe(projectId)
    expect(db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)).toBeUndefined()
    expect(existsSync(folderPath)).toBe(false)
  })

  it('resets linked emails to unprocessed', () => {
    const db = getDb()
    const projectId = randomUUID()
    const folderPath = join(dataDir, 'projects', 'alice-example-com')
    mkdirSync(folderPath, { recursive: true })

    db.prepare(`
      INSERT INTO projects (id, sender_email, folder_path, status, image_order, updated_at)
      VALUES (?, ?, ?, 'In review', '[]', ?)
    `).run(projectId, 'alice@example.com', folderPath, new Date().toISOString())

    db.prepare(`
      INSERT INTO emails (
        id, message_id, sender, subject, received_at,
        has_image_attachments, attachment_count, processed, processed_at,
        status, status_message, project_id
      ) VALUES (?, ?, ?, ?, ?, 1, 1, 1, ?, 'processed', 'done', ?)
    `).run(
      'email-1',
      'msg-1',
      'Alice <alice@example.com>',
      'Photos',
      new Date().toISOString(),
      new Date().toISOString(),
      projectId
    )

    db.prepare(`
      INSERT INTO processing_jobs (id, project_id, state, started_at)
      VALUES (?, ?, 'completed', ?)
    `).run(randomUUID(), projectId, new Date().toISOString())

    deleteProject(projectId)

    const email = db.prepare('SELECT * FROM emails WHERE id = ?').get('email-1') as {
      processed: number
      status: string
      project_id: string | null
      processed_at: string | null
      status_message: string | null
    }
    expect(email.processed).toBe(0)
    expect(email.status).toBe('pending')
    expect(email.project_id).toBeNull()
    expect(email.processed_at).toBeNull()
    expect(email.status_message).toBeNull()

    const jobs = db.prepare('SELECT id FROM processing_jobs WHERE project_id = ?').all(projectId)
    expect(jobs).toHaveLength(0)
  })

  it('throws when project is missing', () => {
    expect(() => deleteProject('missing-id')).toThrow(AppError)
  })
})
