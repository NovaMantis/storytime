import matter from 'gray-matter'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ProjectMarkdownFrontmatter, ProjectStatus } from './types'

export function getProjectMarkdownPath(folderPath: string): string {
  return join(folderPath, 'project.md')
}

export function readProjectMarkdown(folderPath: string): {
  frontmatter: ProjectMarkdownFrontmatter
  body: string
} {
  const path = getProjectMarkdownPath(folderPath)
  if (!existsSync(path)) {
    throw new Error(`project.md not found at ${path}`)
  }
  const raw = readFileSync(path, 'utf8')
  const parsed = matter(raw)
  return {
    frontmatter: {
      status: (parsed.data.status as ProjectStatus) || 'In review',
      imageOrder: (parsed.data.imageOrder as string[]) || [],
      updatedAt: (parsed.data.updatedAt as string) || new Date().toISOString(),
      senderEmail: (parsed.data.senderEmail as string) || ''
    },
    body: parsed.content.trim()
  }
}

export function writeProjectMarkdown(
  folderPath: string,
  frontmatter: ProjectMarkdownFrontmatter,
  body: string
) {
  const path = getProjectMarkdownPath(folderPath)
  const content = matter.stringify(body.trim() ? `${body.trim()}\n` : '', {
    status: frontmatter.status,
    imageOrder: frontmatter.imageOrder,
    updatedAt: frontmatter.updatedAt,
    senderEmail: frontmatter.senderEmail
  })
  writeFileSync(path, content, 'utf8')
}

export function ensureProjectMarkdown(
  folderPath: string,
  senderEmail: string,
  status: ProjectStatus = 'In review'
) {
  const path = getProjectMarkdownPath(folderPath)
  if (existsSync(path)) {
    return
  }
  writeProjectMarkdown(
    folderPath,
    {
      status,
      imageOrder: [],
      updatedAt: new Date().toISOString(),
      senderEmail
    },
    ''
  )
}
