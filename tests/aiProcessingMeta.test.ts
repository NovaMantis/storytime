import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getAiFlagsForFilename,
  readAiProcessingMeta,
  writeAiProcessingMeta
} from '../server/utils/aiProcessingMeta'

describe('aiProcessingMeta', () => {
  let folderPath: string

  beforeEach(() => {
    folderPath = join(tmpdir(), `storytime-ai-meta-${Date.now()}`)
    mkdirSync(join(folderPath, 'processed'), { recursive: true })
    mkdirSync(join(folderPath, 'preprocessed'), { recursive: true })
  })

  afterEach(() => {
    rmSync(folderPath, { recursive: true, force: true })
  })

  it('reads and writes metadata', () => {
    writeAiProcessingMeta(folderPath, {
      aiImageFilenames: ['a.png'],
      aiTextFilenames: ['b.png']
    })

    expect(readAiProcessingMeta(folderPath)).toEqual({
      aiImageFilenames: ['a.png'],
      aiTextFilenames: ['b.png']
    })
  })

  it('uses metadata when present', () => {
    writeAiProcessingMeta(folderPath, {
      aiImageFilenames: ['a.png'],
      aiTextFilenames: []
    })

    expect(getAiFlagsForFilename(folderPath, 'a.png', {
      hasExtractedText: false
    })).toEqual({
      aiImageEnhanced: true,
      aiTextExtracted: false
    })

    expect(getAiFlagsForFilename(folderPath, 'b.png', {
      hasExtractedText: true
    })).toEqual({
      aiImageEnhanced: false,
      aiTextExtracted: true
    })
  })

  it('falls back to byte comparison when metadata is missing', () => {
    writeFileSync(join(folderPath, 'preprocessed', 'same.png'), Buffer.from('same'))
    writeFileSync(join(folderPath, 'processed', 'same.png'), Buffer.from('same'))
    writeFileSync(join(folderPath, 'preprocessed', 'diff.png'), Buffer.from('before'))
    writeFileSync(join(folderPath, 'processed', 'diff.png'), Buffer.from('after'))

    expect(getAiFlagsForFilename(folderPath, 'same.png', {
      meta: null,
      hasExtractedText: false
    })).toEqual({
      aiImageEnhanced: false,
      aiTextExtracted: false
    })

    expect(getAiFlagsForFilename(folderPath, 'diff.png', {
      meta: null,
      hasExtractedText: true
    })).toEqual({
      aiImageEnhanced: true,
      aiTextExtracted: true
    })
  })
})
