import { syncInbox, formatImapError } from '../utils/imap'
import { getImapConfig, isImapConfigured } from '../utils/config'
import { logError, logInfo } from '../utils/logger'

let interval: ReturnType<typeof setInterval> | null = null
let syncing = false

async function runSync() {
  if (syncing || !isImapConfigured()) return
  syncing = true
  try {
    await syncInbox()
  } catch (err) {
    logError('Poller sync failed', {
      error: formatImapError(err)
    })
  } finally {
    syncing = false
  }
}

export default defineNitroPlugin(() => {
  if (!isImapConfigured()) {
    logInfo('IMAP poller disabled — credentials not configured')
    return
  }

  const { pollIntervalMs } = getImapConfig()
  runSync()
  interval = setInterval(runSync, pollIntervalMs)

  if (import.meta.dev) {
    // Allow clean shutdown in dev
    process.on('SIGTERM', () => {
      if (interval) clearInterval(interval)
    })
  }
})
