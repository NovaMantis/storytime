import { mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getProjectsDir } from './config'
import { sanitizeEmail } from './sanitizeEmail'
import { ensureProjectMarkdown, readProjectMarkdown } from './projectMarkdown'
import type { ProjectRow } from './types'
import { getDb } from './db'

export function getProjectFolderPath(senderEmail: string): string {
  return join(getProjectsDir(), sanitizeEmail(senderEmail))
}

export function ensureProjectDirs(folderPath: string) {
  for (const sub of ['original', 'processed', 'thumbnails']) {
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
  ensureProjectMarkdown(folderPath, senderEmail.toLowerCase())

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
      const { frontmatter } = readProjectMarkdown(folderPath)
      const images = listProcessedImageFiles(folderPath)
      db.prepare(`
        INSERT INTO projects (id, sender_email, folder_path, status, image_order, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        frontmatter.senderEmail || entry,
        folderPath,
        frontmatter.status,
        JSON.stringify(frontmatter.imageOrder.length ? frontmatter.imageOrder : images),
        frontmatter.updatedAt
      )
    } catch {
      // skip invalid folders
    }
  }
}
