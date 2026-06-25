import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ensureProjectMarkdown,
  getProjectMarkdownPath,
  readLegacyProjectFrontmatter,
  readProjectNotes,
  writeProjectNotes
} from '../server/utils/projectMarkdown'

const dirs: string[] = []

function tempProjectDir() {
  const dir = join(tmpdir(), `storytime-test-${Date.now()}-${Math.random()}`)
  mkdirSync(dir, { recursive: true })
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('projectMarkdown', () => {
  it('creates empty project.md', () => {
    const dir = tempProjectDir()
    ensureProjectMarkdown(dir)
    expect(readProjectNotes(dir)).toBe('')
  })

  it('round-trips notes', () => {
    const dir = tempProjectDir()
    writeProjectNotes(dir, 'Some notes here')
    expect(readProjectNotes(dir)).toBe('Some notes here')
  })

  it('reads notes from legacy frontmatter files', () => {
    const dir = tempProjectDir()
    writeFileSync(
      getProjectMarkdownPath(dir),
      `---
status: Ready
imageOrder:
  - a.jpg
senderEmail: bob@example.com
---

Legacy notes
`
    )
    expect(readProjectNotes(dir)).toBe('Legacy notes')
    expect(readLegacyProjectFrontmatter(dir)).toEqual({
      status: 'Ready',
      imageOrder: ['a.jpg'],
      senderEmail: 'bob@example.com'
    })
  })
})
