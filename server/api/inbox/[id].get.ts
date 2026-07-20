import { getDb } from '../../utils/db'
import { AppError, throwAppError } from '../../utils/errors'
import { fetchEmailBody, formatImapError } from '../../utils/imap'
import type { EmailRow } from '../../utils/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Email id is required.', 400))
  }

  const db = getDb()
  const row = db
    .prepare(`
      SELECT e.*, p.sender_email AS project_sender_email
      FROM emails e
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.id = ?
    `)
    .get(id) as (EmailRow & { project_sender_email: string | null }) | undefined

  if (!row) {
    throwAppError(new AppError('NOT_FOUND', 'Email not found.', 404))
  }

  let body: { text: string | null, html: string | null, attachments: { filename: string, contentType: string }[] }
  try {
    body = await fetchEmailBody(row)
  } catch (err) {
    throwAppError(new AppError('IMAP_FETCH_FAILED', formatImapError(err), 502))
  }

  return {
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
    projectSenderEmail: row.project_sender_email,
    text: body.text,
    html: body.html,
    attachments: body.attachments
  }
})
