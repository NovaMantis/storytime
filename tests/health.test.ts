import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, getDb } from '../server/utils/db'
import { getDbPath } from '../server/utils/config'

describe('health data dir', () => {
  let dataDir: string

  beforeEach(() => {
    dataDir = join(tmpdir(), `storytime-health-${Date.now()}`)
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

  it('initializes database file', () => {
    expect(existsSync(getDbPath())).toBe(true)
  })
})
