import { syncInbox, formatImapError } from '../../utils/imap'
import { AppError, throwAppError } from '../../utils/errors'
import { isImapConfigured } from '../../utils/config'

export default defineEventHandler(async () => {
  if (!isImapConfigured()) {
    throwAppError(new AppError(
      'IMAP_NOT_CONFIGURED',
      'Zoho IMAP credentials are not configured. Copy .env.example to .env and fill in your details.',
      503
    ))
  }

  try {
    const result = await syncInbox()
    return { ok: true, ...result }
  } catch (err) {
    throwAppError(new AppError('SYNC_FAILED', formatImapError(err), 500))
  }
})
