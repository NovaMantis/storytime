import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ensureProjectMarkdown,
  readProjectMarkdown,
  writeProjectMarkdown
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
  it('creates default project.md', () => {
    const dir = tempProjectDir()
    ensureProjectMarkdown(dir, 'alice@example.com')
    const { frontmatter, body } = readProjectMarkdown(dir)
    expect(frontmatter.status).toBe('In review')
    expect(frontmatter.senderEmail).toBe('alice@example.com')
    expect(body).toBe('')
  })

  it('round-trips frontmatter and body', () => {
    const dir = tempProjectDir()
    writeProjectMarkdown(
      dir,
      {
        status: 'Ready',
        imageOrder: ['a.jpg', 'b.jpg'],
        updatedAt: '2025-06-01T00:00:00.000Z',
        senderEmail: 'bob@example.com'
      },
      'Some notes here'
    )
    const { frontmatter, body } = readProjectMarkdown(dir)
    expect(frontmatter.status).toBe('Ready')
    expect(frontmatter.imageOrder).toEqual(['a.jpg', 'b.jpg'])
    expect(body).toBe('Some notes here')
  })
})
