import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from './db'
import { downloadEmailAttachments } from './imap'
import {
  formatPreprocessSummary,
  listPreprocessedImageFiles,
  preprocessProjectImages
} from './imagePreprocessor'
import {
  findOriginalForProcessedName,
  formatProcessSummary,
  processProjectImages
} from './imageProcessor'
import {
  extractProjectTexts,
  formatTextExtractSummary,
  getTextFilePath
} from './textExtractor'
import {
  ensureProjectDirs,
  getOrCreateProject,
  listProcessedImageFiles
} from './projectFolders'
import { generateThumbnails } from './thumbnails'
import type { EmailRow, ProcessingJobRow, ProjectRow } from './types'
import {
  defaultImageOrder,
  validateProcessSelection
} from './validateProcessSelection'
import { writeAiProcessingMeta } from './aiProcessingMeta'
import { AppError } from './errors'
import { logError } from './logger'
import { throwIfAborted } from './requestAbort'

export interface ReviewImage {
  filename: string
  preprocessedUrl: string
  originalUrl: string | null
  originalFilename: string | null
  preprocessError: string | null
}

export function getPendingReviewJob(projectId: string): ProcessingJobRow | undefined {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM processing_jobs
    WHERE project_id = ? AND state = 'awaiting_review'
    ORDER BY started_at DESC
    LIMIT 1
  `).get(projectId) as ProcessingJobRow | undefined
}

export function buildReviewImages(project: ProjectRow): ReviewImage[] {
  const originalDir = join(project.folder_path, 'original')
  const preprocessedFiles = listPreprocessedImageFiles(project.folder_path)

  return preprocessedFiles.map((filename) => {
    const originalFilename = findOriginalForProcessedName(filename, originalDir)
    return {
      filename,
      preprocessedUrl: `/api/projects/${project.id}/preprocessed/${encodeURIComponent(filename)}`,
      originalUrl: originalFilename
        ? `/api/projects/${project.id}/originals/${encodeURIComponent(originalFilename)}`
        : null,
      originalFilename,
      preprocessError: null
    }
  })
}

export async function preprocessEmails(emailIds: string[]) {
  const db = getDb()
  const emails = emailIds.map((id) => {
    const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined
    if (!row) {
      throw new AppError('EMAIL_NOT_FOUND', `Email not found: ${id}`, 404)
    }
    return row
  })

  validateProcessSelection(emails)

  const senderEmail = emails[0]!.sender.match(/<([^>]+)>/)?.[1]?.toLowerCase()
    || emails[0]!.sender.toLowerCase()
  const project = getOrCreateProject(senderEmail)
  ensureProjectDirs(project.folder_path)

  const pendingJob = getPendingReviewJob(project.id)
  if (pendingJob) {
    throw new AppError(
      'REVIEW_PENDING',
      'This project has images awaiting review. Complete the review before processing more emails.',
      400
    )
  }

  const jobId = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO processing_jobs (id, project_id, state, started_at)
    VALUES (?, ?, 'running', ?)
  `).run(jobId, project.id, now)

  try {
    const originalDir = join(project.folder_path, 'original')
    const downloaded = await downloadEmailAttachments(emails, originalDir)
    const preprocessResult = await preprocessProjectImages(project.folder_path)
    const statusDetail = formatPreprocessSummary(preprocessResult)

    if (
      preprocessResult.preprocessed.length === 0
      && preprocessResult.skipped.length === 0
      && downloaded.length === 0
    ) {
      throw new AppError('NO_IMAGES', 'No supported image files found in attachments.', 400)
    }

    db.prepare(`
      UPDATE processing_jobs SET state = 'awaiting_review' WHERE id = ?
    `).run(jobId)

    const awaitingEmail = db.prepare(`
      UPDATE emails SET
        status = 'awaiting_review',
        status_message = ?,
        project_id = ?
      WHERE id = ?
    `)

    for (const email of emails) {
      awaitingEmail.run(
        `Preprocessed images for ${project.sender_email} (${statusDetail})`,
        project.id,
        email.id
      )
    }

    const images = buildReviewImages(project)

    return {
      jobId,
      projectId: project.id,
      images,
      preprocessResult
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logError('Preprocessing failed', { jobId, error: message })

    db.prepare(`
      UPDATE processing_jobs SET state = 'failed', finished_at = ?, error = ? WHERE id = ?
    `).run(new Date().toISOString(), message, jobId)

    const failEmail = db.prepare(`
      UPDATE emails SET status = 'error', status_message = ? WHERE id = ?
    `)
    for (const email of emails) {
      failEmail.run(message, email.id)
    }

    if (err instanceof AppError) throw err
    throw new AppError('PROCESS_FAILED', message, 500)
  }
}

export interface FinalizeProjectImagesOptions {
  aiFilenames: string[]
  textFilenames: string[]
}

export async function finalizeProjectImages(
  projectId: string,
  selection: FinalizeProjectImagesOptions,
  options?: { signal?: AbortSignal }
) {
  const { aiFilenames, textFilenames } = selection
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as ProjectRow | undefined
  if (!project) {
    throw new AppError('NOT_FOUND', 'Project not found.', 404)
  }

  const job = getPendingReviewJob(projectId)
  if (!job) {
    throw new AppError('NO_PENDING_REVIEW', 'No images are awaiting review for this project.', 400)
  }

  const preprocessedFiles = listPreprocessedImageFiles(project.folder_path)
  if (preprocessedFiles.length === 0) {
    throw new AppError('NO_PREPROCESSED', 'No preprocessed images found.', 400)
  }

  const aiSet = new Set(aiFilenames)
  const textSet = new Set(textFilenames)
  const originalDir = join(project.folder_path, 'original')
  const preprocessedDir = join(project.folder_path, 'preprocessed')
  const processedDir = join(project.folder_path, 'processed')
  mkdirSync(processedDir, { recursive: true })

  db.prepare(`UPDATE processing_jobs SET state = 'enhancing' WHERE id = ?`).run(job.id)

  const aiOriginals: string[] = []
  const warnings: string[] = []

  for (const filename of preprocessedFiles) {
    const originalFilename = findOriginalForProcessedName(filename, originalDir)
    if (!originalFilename) {
      warnings.push(`No original found for ${filename}`)
      continue
    }

    if (aiSet.has(filename)) {
      aiOriginals.push(originalFilename)
    }
  }

  let aiResult = { processed: [] as string[], skipped: [] as string[], failed: [] as { file: string, error: string }[] }
  let textResult = { extracted: [] as string[], skipped: [] as string[], failed: [] as { file: string, error: string }[] }

  const textTargets = preprocessedFiles.filter(f => textSet.has(f))

  try {
    throwIfAborted(options?.signal)

    const textPromise = textTargets.length > 0
      ? extractProjectTexts(project.folder_path, {
          filenames: textTargets,
          forceOverwrite: true,
          signal: options?.signal
        })
      : Promise.resolve(textResult)

    const imagePromise = aiOriginals.length > 0
      ? processProjectImages(project.folder_path, {
          filenames: aiOriginals,
          forceOverwrite: true,
          signal: options?.signal
        })
      : Promise.resolve(aiResult)

    ;[textResult, aiResult] = await Promise.all([textPromise, imagePromise])

    throwIfAborted(options?.signal)

    for (const filename of preprocessedFiles) {
      const outputPath = join(processedDir, filename)

      if (aiSet.has(filename)) {
        if (!existsSync(outputPath)) {
          const source = join(preprocessedDir, filename)
          if (existsSync(source)) {
            copyFileSync(source, outputPath)
            warnings.push(`AI failed for ${filename}; used preprocessed version`)
          }
        }
        continue
      }

      copyFileSync(join(preprocessedDir, filename), outputPath)
    }

    const processedFiles = listProcessedImageFiles(project.folder_path)
    const imageOrder = defaultImageOrder(processedFiles)
    await generateThumbnails(project.folder_path, imageOrder)

    writeAiProcessingMeta(project.folder_path, {
      aiImageFilenames: aiResult.processed,
      aiTextFilenames: textResult.extracted
    })

    const updatedAt = new Date().toISOString()
    db.prepare(`
      UPDATE projects SET image_order = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(imageOrder), updatedAt, project.id)

    const statusParts = [
      formatProcessSummary(aiResult),
      formatTextExtractSummary(textResult),
      aiFilenames.length ? `AI enhanced ${aiFilenames.length} image(s)` : null,
      textFilenames.length ? `text extracted from ${textFilenames.length} image(s)` : null
    ].filter(Boolean)

    const statusDetail = statusParts.length > 0
      ? statusParts.join('; ')
      : 'used preprocessed only'

    const processedAt = new Date().toISOString()
    db.prepare(`
      UPDATE emails SET
        processed = 1,
        processed_at = ?,
        status = 'processed',
        status_message = ?
      WHERE project_id = ? AND status = 'awaiting_review'
    `).run(processedAt, statusDetail, project.id)

    db.prepare(`
      UPDATE processing_jobs SET state = 'completed', finished_at = ? WHERE id = ?
    `).run(processedAt, job.id)

    return {
      projectId: project.id,
      imageOrder,
      aiResult,
      textResult,
      warnings,
      thumbnails: imageOrder.map(f => ({
        filename: f,
        url: `/api/projects/${project.id}/thumbnails/${encodeURIComponent(f)}`
      }))
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const cancelled = options?.signal?.aborted || message === 'Request aborted'

    if (cancelled) {
      for (const filename of aiResult.processed) {
        const outputPath = join(processedDir, filename)
        if (existsSync(outputPath)) {
          unlinkSync(outputPath)
        }
      }

      for (const filename of textResult.extracted) {
        const textPath = getTextFilePath(project.folder_path, filename)
        if (existsSync(textPath)) {
          unlinkSync(textPath)
        }
      }

      db.prepare(`UPDATE processing_jobs SET state = 'awaiting_review' WHERE id = ?`).run(job.id)
      throw new AppError('CANCELLED', 'Image processing was cancelled.', 499)
    }

    logError('Finalize failed', { projectId, error: message })

    db.prepare(`
      UPDATE processing_jobs SET state = 'failed', finished_at = ?, error = ? WHERE id = ?
    `).run(new Date().toISOString(), message, job.id)

    if (err instanceof AppError) throw err
    throw new AppError('FINALIZE_FAILED', message, 500)
  }
}
