import { getDb } from '../../../utils/db'
import {
  MANUSCRIPT_PAGE_HEIGHT_IN,
  MANUSCRIPT_PAGE_WIDTH_IN,
  normalizeCrop,
  normalizeManuscript,
  normalizeTextColor,
  pageImages,
  writeManuscript,
  type Manuscript
} from '../../../utils/manuscript'
import { AppError, throwAppError } from '../../../utils/errors'
import type { ProjectRow } from '../../../utils/types'

function isManuscript(value: unknown): value is Manuscript {
  if (!value || typeof value !== 'object') return false
  const m = value as Manuscript
  return m.version === 1
    && typeof m.pageWidthIn === 'number'
    && typeof m.pageHeightIn === 'number'
    && typeof m.defaultFontFamily === 'string'
    && Array.isArray(m.pages)
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throwAppError(new AppError('INVALID_ID', 'Project id is required.', 400))
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  if (!project) {
    throwAppError(new AppError('NOT_FOUND', 'Project not found.', 404))
  }

  const body = await readBody<{ manuscript?: Manuscript }>(event)
  if (!isManuscript(body.manuscript)) {
    throwAppError(new AppError('INVALID_MANUSCRIPT', 'A valid manuscript payload is required.', 400))
  }

  const manuscript = normalizeManuscript({
    ...body.manuscript,
    pageWidthIn: MANUSCRIPT_PAGE_WIDTH_IN,
    pageHeightIn: MANUSCRIPT_PAGE_HEIGHT_IN,
    version: 1,
    pages: body.manuscript.pages.map(page => ({
      id: page.id,
      background: 'white',
      images: pageImages(page).map(img => ({
        id: img.id,
        source: img.source === 'global' ? 'global' as const : 'project' as const,
        filename: img.filename,
        mediaId: img.mediaId,
        x: Number(img.x),
        y: Number(img.y),
        width: Number(img.width),
        height: Number(img.height),
        crop: normalizeCrop(img.crop)
      })),
      textBoxes: (page.textBoxes || []).map(box => ({
        id: box.id,
        text: String(box.text ?? ''),
        x: Number(box.x),
        y: Number(box.y),
        width: Number(box.width),
        height: Number(box.height),
        fontFamily: String(box.fontFamily || 'Literata'),
        fontSizePt: Number(box.fontSizePt) || 14,
        align: box.align === 'left' || box.align === 'right' ? box.align : 'center',
        color: normalizeTextColor(box.color)
      }))
    }))
  })

  writeManuscript(project.folder_path, manuscript)

  return { ok: true, manuscript }
})
