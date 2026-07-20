import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, getDb } from '../server/utils/db'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_MANUSCRIPT_FONT,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TEXT_PROMPT,
  getImageModel,
  getImagePrompt,
  getManuscriptDefaultFont,
  getTextModel,
  getTextPrompt,
  initImageModel,
  initImagePrompt,
  initManuscriptDefaultFont,
  initTextModel,
  initTextPrompt,
  setImageModel,
  setImagePrompt,
  setManuscriptDefaultFont,
  setTextModel,
  setTextPrompt
} from '../server/utils/settings'

describe('image prompt settings', () => {
  let dataDir: string
  const originalPrompt = process.env.OPENAI_IMAGE_PROMPT

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-settings-${Date.now()}`)
    mkdirSync(dataDir, { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    delete process.env.OPENAI_IMAGE_PROMPT
    closeDb()
    getDb()
  })

  afterEach(() => {
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
    if (originalPrompt === undefined) {
      delete process.env.OPENAI_IMAGE_PROMPT
    } else {
      process.env.OPENAI_IMAGE_PROMPT = originalPrompt
    }
  })

  it('seeds the default prompt on init', () => {
    initImagePrompt()
    expect(getImagePrompt()).toBe(DEFAULT_IMAGE_PROMPT)
    expect(existsSync(join(dataDir, 'storytime.db'))).toBe(true)
  })

  it('migrates prompt from env on first init', () => {
    process.env.OPENAI_IMAGE_PROMPT = 'custom env prompt'
    initImagePrompt()
    expect(getImagePrompt()).toBe('custom env prompt')
  })

  it('persists prompt updates', () => {
    initImagePrompt()
    setImagePrompt('updated prompt')
    expect(getImagePrompt()).toBe('updated prompt')
  })
})

describe('text prompt settings', () => {
  let dataDir: string
  const originalPrompt = process.env.OPENAI_TEXT_PROMPT

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-text-settings-${Date.now()}`)
    mkdirSync(dataDir, { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    delete process.env.OPENAI_TEXT_PROMPT
    closeDb()
    getDb()
  })

  afterEach(() => {
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
    if (originalPrompt === undefined) {
      delete process.env.OPENAI_TEXT_PROMPT
    } else {
      process.env.OPENAI_TEXT_PROMPT = originalPrompt
    }
  })

  it('seeds the default text prompt on init', () => {
    initTextPrompt()
    expect(getTextPrompt()).toBe(DEFAULT_TEXT_PROMPT)
  })

  it('migrates text prompt from env on first init', () => {
    process.env.OPENAI_TEXT_PROMPT = 'custom text prompt'
    initTextPrompt()
    expect(getTextPrompt()).toBe('custom text prompt')
  })

  it('persists text prompt updates', () => {
    initTextPrompt()
    setTextPrompt('updated text prompt')
    expect(getTextPrompt()).toBe('updated text prompt')
  })
})

describe('image model settings', () => {
  let dataDir: string
  const originalModel = process.env.OPENAI_IMAGE_MODEL

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-image-model-settings-${Date.now()}`)
    mkdirSync(dataDir, { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    delete process.env.OPENAI_IMAGE_MODEL
    closeDb()
    getDb()
  })

  afterEach(() => {
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
    if (originalModel === undefined) {
      delete process.env.OPENAI_IMAGE_MODEL
    } else {
      process.env.OPENAI_IMAGE_MODEL = originalModel
    }
  })

  it('seeds the default image model on init', () => {
    initImageModel()
    expect(getImageModel()).toBe(DEFAULT_IMAGE_MODEL)
  })

  it('migrates image model from env on first init', () => {
    process.env.OPENAI_IMAGE_MODEL = 'custom-image-model'
    initImageModel()
    expect(getImageModel()).toBe('custom-image-model')
  })

  it('persists image model updates', () => {
    initImageModel()
    setImageModel('updated-image-model')
    expect(getImageModel()).toBe('updated-image-model')
  })
})

describe('text model settings', () => {
  let dataDir: string
  const originalModel = process.env.OPENAI_TEXT_MODEL

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-text-model-settings-${Date.now()}`)
    mkdirSync(dataDir, { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    delete process.env.OPENAI_TEXT_MODEL
    closeDb()
    getDb()
  })

  afterEach(() => {
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
    if (originalModel === undefined) {
      delete process.env.OPENAI_TEXT_MODEL
    } else {
      process.env.OPENAI_TEXT_MODEL = originalModel
    }
  })

  it('seeds the default text model on init', () => {
    initTextModel()
    expect(getTextModel()).toBe(DEFAULT_TEXT_MODEL)
  })

  it('migrates text model from env on first init', () => {
    process.env.OPENAI_TEXT_MODEL = 'custom-text-model'
    initTextModel()
    expect(getTextModel()).toBe('custom-text-model')
  })

  it('persists text model updates', () => {
    initTextModel()
    setTextModel('updated-text-model')
    expect(getTextModel()).toBe('updated-text-model')
  })
})

describe('manuscript default font settings', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-manuscript-font-${Date.now()}`)
    mkdirSync(dataDir, { recursive: true })
    process.env.STORYTIME_DATA_DIR = dataDir
    closeDb()
    getDb()
  })

  afterEach(() => {
    closeDb()
    rmSync(dataDir, { recursive: true, force: true })
    delete process.env.STORYTIME_DATA_DIR
  })

  it('seeds Literata on init', () => {
    initManuscriptDefaultFont()
    expect(getManuscriptDefaultFont()).toBe(DEFAULT_MANUSCRIPT_FONT)
  })

  it('persists font updates', () => {
    initManuscriptDefaultFont()
    setManuscriptDefaultFont('Merriweather')
    expect(getManuscriptDefaultFont()).toBe('Merriweather')
  })
})
