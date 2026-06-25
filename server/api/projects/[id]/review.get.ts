import { getDb } from '../../../utils/db'
import { buildReviewImages, getPendingReviewJob } from '../../../utils/processPipeline'
import { AppError, throwAppError } from '../../../utils/errors'
import type { ProjectRow } from '../../../utils/types'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Project id is required.', 400))
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) {
    throwAppError(new AppError('NOT_FOUND', 'Project not found.', 404))
  }

  const job = getPendingReviewJob(project.id)
  if (!job) {
    throwAppError(new AppError('NO_PENDING_REVIEW', 'No images are awaiting review for this project.', 404))
  }

  return {
    projectId: project.id,
    senderEmail: project.sender_email,
    jobId: job.id,
    images: buildReviewImages(project)
  }
})
