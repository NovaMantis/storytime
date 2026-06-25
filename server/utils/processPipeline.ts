import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { getDb } from './db'
import { downloadEmailAttachments } from './imap'
import {
  ensureProjectDirs,
  getOrCreateProject,
  listProcessedImageFiles
} from './projectFolders'
import { readProjectMarkdown, writeProjectMarkdown } from './projectMarkdown'
import { runPythonScript } from './pythonRunner'
import { generateThumbnails } from './thumbnails'
import type { EmailRow } from './types'
import {
  defaultImageOrder,
  validateProcessSelection
} from './validateProcessSelection'
import { AppError } from './errors'
import { logError } from './logger'

export async function processEmails(emailIds: string[]) {
  const db = getDb()
  const emails = emailIds.map((id) => {
    const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined
    if (!row) {
      throw new AppError('EMAIL_NOT_FOUND', `Email not found: ${id}`, 404)
    }
    return row
  })

  validateProcessSelection(emails)

  const senderEmail = emails[0]!.sender.match(/<([^>]+)>/)?.[1]?.toLowerCase()
    || emails[0]!.sender.toLowerCase()
  const project = getOrCreateProject(senderEmail)
  ensureProjectDirs(project.folder_path)

  const jobId = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO processing_jobs (id, project_id, state, started_at)
    VALUES (?, ?, 'running', ?)
  `).run(jobId, project.id, now)

  try {
    const originalDir = join(project.folder_path, 'original')
    await downloadEmailAttachments(emails, originalDir)
    await runPythonScript(project.folder_path)

    const processedFiles = listProcessedImageFiles(project.folder_path)
    const imageOrder = defaultImageOrder(processedFiles)
    await generateThumbnails(project.folder_path, imageOrder)

    let notes = ''
    let status = project.status
    try {
      const md = readProjectMarkdown(project.folder_path)
      notes = md.body
      status = md.frontmatter.status
    } catch {
      // new project
    }

    writeProjectMarkdown(
      project.folder_path,
      {
        status,
        imageOrder,
        updatedAt: new Date().toISOString(),
        senderEmail: project.sender_email
      },
      notes
    )

    const updatedAt = new Date().toISOString()
    db.prepare(`
      UPDATE projects SET image_order = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(imageOrder), updatedAt, project.id)

    const processedAt = new Date().toISOString()
    const updateEmail = db.prepare(`
      UPDATE emails SET
        processed = 1,
        processed_at = ?,
        status = 'processed',
        status_message = ?,
        project_id = ?
      WHERE id = ?
    `)

    for (const email of emails) {
      updateEmail.run(
        processedAt,
        `Saved attachments and processed for project ${project.sender_email}`,
        project.id,
        email.id
      )
    }

    db.prepare(`
      UPDATE processing_jobs SET state = 'completed', finished_at = ? WHERE id = ?
    `).run(processedAt, jobId)

    return {
      jobId,
      projectId: project.id,
      imageOrder,
      thumbnails: imageOrder.map(f => ({
        filename: f,
        url: `/api/projects/${project.id}/thumbnails/${encodeURIComponent(f)}`
      }))
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logError('Processing failed', { jobId, error: message })

    db.prepare(`
      UPDATE processing_jobs SET state = 'failed', finished_at = ?, error = ? WHERE id = ?
    `).run(new Date().toISOString(), message, jobId)

    const failEmail = db.prepare(`
      UPDATE emails SET status = 'error', status_message = ? WHERE id = ?
    `)
    for (const email of emails) {
      failEmail.run(message, email.id)
    }

    if (err instanceof AppError) throw err
    throw new AppError('PROCESS_FAILED', message, 500)
  }
}
