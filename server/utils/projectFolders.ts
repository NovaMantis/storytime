import { mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getProjectsDir } from './config'
import { sanitizeEmail } from './sanitizeEmail'
import { ensureProjectMarkdown, readLegacyProjectFrontmatter } from './projectMarkdown'
import { defaultImageOrder } from './validateProcessSelection'
import type { ProjectRow } from './types'
import { getDb } from './db'
import { AppError } from './errors'

export function getProjectFolderPath(senderEmail: string): string {
  return join(getProjectsDir(), sanitizeEmail(senderEmail))
}

export function ensureProjectDirs(folderPath: string) {
  for (const sub of ['original', 'preprocessed', 'processed', 'thumbnails', 'text']) {
    mkdirSync(join(folderPath, sub), { recursive: true })
  }
}

export function getOrCreateProject(senderEmail: string): ProjectRow {
  const db = getDb()
  const existing = db
    .prepare('SELECT * FROM projects WHERE sender_email = ?')
    .get(senderEmail.toLowerCase()) as ProjectRow | undefined

  if (existing) {
    return existing
  }

  const folderPath = getProjectFolderPath(senderEmail)
  ensureProjectDirs(folderPath)
  ensureProjectMarkdown(folderPath)

  const project: ProjectRow = {
    id: randomUUID(),
    sender_email: senderEmail.toLowerCase(),
    folder_path: folderPath,
    status: 'In review',
    image_order: '[]',
    updated_at: new Date().toISOString()
  }

  db.prepare(`
    INSERT INTO projects (id, sender_email, folder_path, status, image_order, updated_at)
    VALUES (@id, @sender_email, @folder_path, @status, @image_order, @updated_at)
  `).run(project)

  return project
}

export function listProcessedImageFiles(folderPath: string): string[] {
  const processedDir = join(folderPath, 'processed')
  if (!existsSync(processedDir)) {
    return []
  }
  return readdirSync(processedDir)
    .filter((f: string) => /\.(jpe?g|png|gif|webp|tiff?)$/i.test(f))
    .sort()
}

export function deleteProject(id: string) {
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) {
    throw new AppError('NOT_FOUND', 'Project not found.', 404)
  }

  db.prepare(`
    UPDATE emails SET
      project_id = NULL,
      processed = 0,
      processed_at = NULL,
      status = 'pending',
      status_message = NULL
    WHERE project_id = ?
  `).run(id)

  db.prepare('DELETE FROM processing_jobs WHERE project_id = ?').run(id)
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)

  if (existsSync(project.folder_path)) {
    rmSync(project.folder_path, { recursive: true, force: true })
  }

  return { id: project.id }
}

export function reconcileProjectsFromDisk() {
  const projectsDir = getProjectsDir()
  if (!existsSync(projectsDir)) {
    mkdirSync(projectsDir, { recursive: true })
    return
  }
  const db = getDb()
  for (const entry of readdirSync(projectsDir)) {
    const folderPath = join(projectsDir, entry)
    if (!statSync(folderPath).isDirectory()) continue
    const mdPath = join(folderPath, 'project.md')
    if (!existsSync(mdPath)) continue
    const existing = db.prepare('SELECT id FROM projects WHERE folder_path = ?').get(folderPath)
    if (existing) continue
    try {
      const legacy = readLegacyProjectFrontmatter(folderPath)
      const images = listProcessedImageFiles(folderPath)
      const imageOrder = legacy?.imageOrder?.length
        ? legacy.imageOrder
        : defaultImageOrder(images)
      db.prepare(`
        INSERT INTO projects (id, sender_email, folder_path, status, image_order, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        legacy?.senderEmail || entry.replace(/-at-/g, '@'),
        folderPath,
        legacy?.status || 'In review',
        JSON.stringify(imageOrder),
        new Date().toISOString()
      )
    } catch {
      // skip invalid folders
    }
  }
}
