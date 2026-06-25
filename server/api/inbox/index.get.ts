import { getDb } from '../../utils/db'
import type { EmailRow } from '../../utils/types'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const filter = (query.filter as string) || 'all'
  const withAttachments = query.withAttachments !== 'false'
  const email = String(query.email || '').trim().toLowerCase()
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 50)))
  const offset = (page - 1) * pageSize

  const conditions: string[] = []
  if (filter === 'archived') {
    conditions.push('archived = 1')
  } else {
    conditions.push('archived = 0')
    if (filter === 'unprocessed') {
      conditions.push(`status = 'pending' AND has_image_attachments = 1`)
    } else if (filter === 'processed') {
      conditions.push(`status = 'processed'`)
    } else if (filter === 'awaiting-review') {
      conditions.push(`status = 'awaiting_review'`)
    } else if (filter === 'errors') {
      conditions.push(`status = 'error'`)
    } else if (filter === 'no-images') {
      conditions.push(`has_image_attachments = 0`)
    } else if (withAttachments) {
      conditions.push(`has_image_attachments = 1`)
    }
  }
  if (email) {
    conditions.push('LOWER(sender) LIKE ?')
  }

  const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1'
  const filterParams = email ? [`%${email}%`] : []

  const db = getDb()
  const total = (db.prepare(`SELECT COUNT(*) as count FROM emails WHERE ${where}`).get(...filterParams) as { count: number }).count
  const emails = db
    .prepare(`
      SELECT e.*, p.sender_email AS project_sender_email
      FROM emails e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE ${where.replace(/\b(archived|status|has_image_attachments|sender)\b/g, 'e.$1')}
      ORDER BY e.received_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...filterParams, pageSize, offset) as (EmailRow & { project_sender_email: string | null })[]

  return {
    emails: emails.map(row => ({
      id: row.id,
      sender: row.sender,
      subject: row.subject,
      received_at: row.received_at,
      has_image_attachments: Boolean(row.has_image_attachments),
      attachment_count: row.attachment_count,
      processed: Boolean(row.processed),
      archived: Boolean(row.archived),
      status: row.status,
      status_message: row.status_message,
      projectId: row.project_id,
      projectSenderEmail: row.project_sender_email
    })),
    pagination: { page, pageSize, total }
  }
})
