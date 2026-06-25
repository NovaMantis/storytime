import { getDb } from '../../utils/db'
import type { EmailRow } from '../../utils/types'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const filter = (query.filter as string) || 'all'
  const page = Math.max(1, Number(query.page || 1))
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 50)))
  const offset = (page - 1) * pageSize

  let where = '1=1'
  if (filter === 'unprocessed') {
    where = `status = 'pending' AND has_image_attachments = 1`
  } else if (filter === 'processed') {
    where = `status = 'processed'`
  } else if (filter === 'errors') {
    where = `status = 'error'`
  } else if (filter === 'no-images') {
    where = `has_image_attachments = 0`
  }

  const db = getDb()
  const total = (db.prepare(`SELECT COUNT(*) as count FROM emails WHERE ${where}`).get() as { count: number }).count
  const emails = db
    .prepare(`SELECT * FROM emails WHERE ${where} ORDER BY received_at DESC LIMIT ? OFFSET ?`)
    .all(pageSize, offset) as EmailRow[]

  return {
    emails: emails.map(row => ({
      ...row,
      has_image_attachments: Boolean(row.has_image_attachments),
      processed: Boolean(row.processed)
    })),
    pagination: { page, pageSize, total }
  }
})
