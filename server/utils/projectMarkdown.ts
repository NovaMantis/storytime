import matter from 'gray-matter'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ProjectStatus } from './types'

export function getProjectMarkdownPath(folderPath: string): string {
  return join(folderPath, 'project.md')
}

/** Read notes from project.md, stripping any legacy YAML frontmatter. */
export function readProjectNotes(folderPath: string): string {
  const path = getProjectMarkdownPath(folderPath)
  if (!existsSync(path)) {
    return ''
  }
  const raw = readFileSync(path, 'utf8')
  return matter(raw).content.trim()
}

export function writeProjectNotes(folderPath: string, notes: string) {
  const path = getProjectMarkdownPath(folderPath)
  const content = notes.trim() ? `${notes.trim()}\n` : ''
  writeFileSync(path, content, 'utf8')
}

/** One-time import helper for folders created before notes-only project.md. */
export function readLegacyProjectFrontmatter(folderPath: string): {
  status?: ProjectStatus
  imageOrder?: string[]
  senderEmail?: string
} | null {
  const path = getProjectMarkdownPath(folderPath)
  if (!existsSync(path)) {
    return null
  }
  const raw = readFileSync(path, 'utf8')
  const parsed = matter(raw)
  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    return null
  }
  return {
    status: parsed.data.status as ProjectStatus | undefined,
    imageOrder: parsed.data.imageOrder as string[] | undefined,
    senderEmail: parsed.data.senderEmail as string | undefined
  }
}

export function ensureProjectMarkdown(folderPath: string) {
  const path = getProjectMarkdownPath(folderPath)
  if (existsSync(path)) {
    return
  }
  writeProjectNotes(folderPath, '')
}
