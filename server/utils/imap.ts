import { ImapFlow } from 'imapflow'
import { createHash, randomUUID } from 'node:crypto'
import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getImapConfig, isImapConfigured } from './config'
import { getDb, setMeta } from './db'
import { logError, logInfo } from './logger'
import { extractEmailAddress } from './sanitizeEmail'
import type { EmailRow } from './types'

interface AttachmentInfo {
  filename: string
  contentType: string
}

interface SyncedEmail {
  messageId: string
  uid: number
  sender: string
  subject: string
  receivedAt: string
  attachments: AttachmentInfo[]
}

function createImapClient() {
  const config = getImapConfig()
  return new ImapFlow({
    host: config.host,
    port: 993,
    secure: true,
    auth: {
      user: config.user,
      pass: config.password
    },
    logger: false
  })
}

function isImageAttachment(contentType: string): boolean {
  return contentType.toLowerCase().startsWith('image/')
}

export async function syncInbox(): Promise<{ synced: number }> {
  if (!isImapConfigured()) {
    throw new Error('IMAP credentials are not configured')
  }

  const config = getImapConfig()
  const client = createImapClient()
  let synced = 0

  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)
    try {
      const messages: SyncedEmail[] = []
      for await (const message of client.fetch('1:*', {
        uid: true,
        envelope: true,
        bodyStructure: true,
        headers: ['message-id']
      })) {
        const messageId = message.headers?.get('message-id')?.[0]
          || `generated-${message.uid}@storytime.local`
        const attachments = collectImageAttachments(message.bodyStructure)
        const sender = message.envelope?.from?.[0]
          ? `${message.envelope.from[0].name || ''} <${message.envelope.from[0].address}>`.trim()
          : 'unknown@unknown'
        const subject = message.envelope?.subject || '(no subject)'
        const receivedAt = message.envelope?.date?.toISOString() || new Date().toISOString()

        messages.push({
          messageId,
          uid: message.uid,
          sender,
          subject,
          receivedAt,
          attachments
        })
      }

      const db = getDb()
      const upsert = db.prepare(`
        INSERT INTO emails (
          id, message_id, imap_uid, sender, subject, received_at,
          has_image_attachments, attachment_count, processed, status, status_message
        ) VALUES (
          @id, @message_id, @imap_uid, @sender, @subject, @received_at,
          @has_image_attachments, @attachment_count, 0, @status, @status_message
        )
        ON CONFLICT(message_id) DO UPDATE SET
          imap_uid = excluded.imap_uid,
          sender = excluded.sender,
          subject = excluded.subject,
          received_at = excluded.received_at,
          has_image_attachments = excluded.has_image_attachments,
          attachment_count = excluded.attachment_count,
          status = CASE
            WHEN emails.processed = 1 THEN emails.status
            WHEN excluded.has_image_attachments = 0 THEN 'skipped'
            ELSE 'pending'
          END,
          status_message = CASE
            WHEN emails.processed = 1 THEN emails.status_message
            WHEN excluded.has_image_attachments = 0 THEN 'No image attachments'
            ELSE NULL
          END
      `)

      for (const msg of messages) {
        const hasImages = msg.attachments.length > 0
        upsert.run({
          id: randomUUID(),
          message_id: msg.messageId,
          imap_uid: msg.uid,
          sender: msg.sender,
          subject: msg.subject,
          received_at: msg.receivedAt,
          has_image_attachments: hasImages ? 1 : 0,
          attachment_count: msg.attachments.length,
          status: hasImages ? 'pending' : 'skipped',
          status_message: hasImages ? null : 'No image attachments'
        })
        synced++
      }
    } finally {
      lock.release()
    }

    setMeta('last_sync_at', new Date().toISOString())
    setMeta('last_sync_status', 'ok')
    setMeta('last_sync_error', '')
    logInfo('Inbox sync completed', { synced })
    return { synced }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setMeta('last_sync_at', new Date().toISOString())
    setMeta('last_sync_status', 'error')
    setMeta('last_sync_error', message)
    logError('Inbox sync failed', { error: message })
    throw err
  } finally {
    await client.logout().catch(() => {})
  }
}

function collectImageAttachments(structure: unknown, results: AttachmentInfo[] = []): AttachmentInfo[] {
  if (!structure || typeof structure !== 'object') {
    return results
  }
  const node = structure as {
    disposition?: string
    dispositionParameters?: { filename?: string }
    parameters?: { name?: string }
    type?: string
    subtype?: string
    childNodes?: unknown[]
  }

  const filename = node.dispositionParameters?.filename || node.parameters?.name
  const contentType = node.type && node.subtype
    ? `${node.type}/${node.subtype}`
  : ''

  if (filename && isImageAttachment(contentType)) {
    results.push({ filename, contentType })
  }

  if (node.childNodes) {
    for (const child of node.childNodes) {
      collectImageAttachments(child, results)
    }
  }
  return results
}

export async function downloadEmailAttachments(
  emails: EmailRow[],
  originalDir: string
): Promise<string[]> {
  if (!isImapConfigured()) {
    throw new Error('IMAP credentials are not configured')
  }

  const config = getImapConfig()
  const client = createImapClient()
  const saved: string[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock(config.mailbox)
    try {
      for (const email of emails) {
        if (!email.imap_uid) continue
        const message = await client.fetchOne(email.imap_uid, { source: true }, { uid: true })
        if (!message?.source) continue

        const { simpleParser } = await import('mailparser')
        const parsed = await simpleParser(message.source)
        for (const attachment of parsed.attachments) {
          if (!attachment.contentType?.startsWith('image/')) continue
          const filename = sanitizeFilename(attachment.filename || `image-${saved.length + 1}.jpg`)
          const dest = join(originalDir, filename)
          if (!existsSync(dest)) {
            writeFileSync(dest, attachment.content)
            saved.push(filename)
          }
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }

  return saved
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

export function getSenderFromEmails(emails: EmailRow[]): string {
  return extractEmailAddress(emails[0]!.sender)
}
