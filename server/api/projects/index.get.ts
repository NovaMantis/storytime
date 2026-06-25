import { getDb } from '../../utils/db'
import { getPendingReviewJob } from '../../utils/processPipeline'
import type { ProjectRow } from '../../utils/types'

export default defineEventHandler(() => {
  const db = getDb()
  const projects = db
    .prepare('SELECT * FROM projects ORDER BY updated_at DESC')
    .all() as ProjectRow[]

  return {
    projects: projects.map(p => ({
      id: p.id,
      senderEmail: p.sender_email,
      status: p.status,
      imageCount: JSON.parse(p.image_order || '[]').length,
      updatedAt: p.updated_at,
      pendingReview: Boolean(getPendingReviewJob(p.id))
    }))
  }
})
