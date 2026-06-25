import { accessSync, constants } from 'node:fs'
import { getDataDir, getDbPath, isImapConfigured } from '../utils/config'
import { getMeta } from '../utils/db'

export default defineEventHandler(() => {
  let dataDirWritable = false
  try {
    accessSync(getDataDir(), constants.W_OK)
    dataDirWritable = true
  } catch {
    dataDirWritable = false
  }

  return {
    ok: true,
    dataDir: getDataDir(),
    dbPath: getDbPath(),
    dataDirWritable,
    imapConfigured: isImapConfigured(),
    lastSyncAt: getMeta('last_sync_at'),
    lastSyncStatus: getMeta('last_sync_status') || 'unknown',
    lastSyncError: getMeta('last_sync_error') || null
  }
})
