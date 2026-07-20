import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { extname, join } from 'node:path'
import sharp from 'sharp'
import { getDataDir } from './config'
import { AppError } from './errors'

export const ALLOWED_MEDIA_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
])

export const ALLOWED_MEDIA_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])

export interface MediaItem {
  id: string
  filename: string
  originalName: string
  mime: string
  width: number
  height: number
  createdAt: string
}

interface MediaMetaFile {
  items: MediaItem[]
}

const THUMB_WIDTH = 300

export function getMediaDir(): string {
  return join(getDataDir(), 'media')
}

export function getMediaThumbsDir(): string {
  return join(getMediaDir(), 'thumbs')
}

function getMetaPath(): string {
  return join(getMediaDir(), 'meta.json')
}

export function ensureMediaDirs(): void {
  mkdirSync(getMediaDir(), { recursive: true })
  mkdirSync(getMediaThumbsDir(), { recursive: true })
  if (!existsSync(getMetaPath())) {
    writeFileSync(getMetaPath(), `${JSON.stringify({ items: [] }, null, 2)}\n`, 'utf8')
  }
}

function readMeta(): MediaMetaFile {
  ensureMediaDirs()
  try {
    const raw = JSON.parse(readFileSync(getMetaPath(), 'utf8')) as MediaMetaFile
    return { items: Array.isArray(raw.items) ? raw.items : [] }
  } catch {
    return { items: [] }
  }
}

function writeMeta(meta: MediaMetaFile): void {
  ensureMediaDirs()
  writeFileSync(getMetaPath(), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
}

function extForMime(mime: string, originalName: string): string {
  const fromName = extname(originalName).toLowerCase()
  if (ALLOWED_MEDIA_EXTS.has(fromName)) return fromName === '.jpeg' ? '.jpg' : fromName
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  return '.jpg'
}

export function listMediaItems(): Array<MediaItem & { url: string, thumbnailUrl: string }> {
  const { items } = readMeta()
  return items
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(item => ({
      ...item,
      url: `/api/media/${item.id}`,
      thumbnailUrl: `/api/media/${item.id}/thumb`
    }))
}

export function getMediaItem(id: string): MediaItem | null {
  return readMeta().items.find(item => item.id === id) ?? null
}

export function getMediaFilePath(item: MediaItem): string {
  return join(getMediaDir(), item.filename)
}

export function getMediaThumbPath(item: MediaItem): string {
  return join(getMediaThumbsDir(), `${item.id}.jpg`)
}

export async function saveMediaUpload(input: {
  data: Buffer
  originalName: string
  mime: string
}): Promise<MediaItem & { url: string, thumbnailUrl: string }> {
  ensureMediaDirs()
  const mime = (input.mime || '').toLowerCase()
  const ext = extForMime(mime, input.originalName)
  if (!ALLOWED_MEDIA_MIMES.has(mime) && !ALLOWED_MEDIA_EXTS.has(ext)) {
    throw new AppError(
      'INVALID_MEDIA_TYPE',
      'Only PNG, JPG, WEBP, and GIF images are allowed.',
      400
    )
  }

  let meta
  try {
    meta = await sharp(input.data, { animated: false }).metadata()
  } catch {
    throw new AppError('INVALID_IMAGE', 'Could not read image file.', 400)
  }
  if (!meta.width || !meta.height) {
    throw new AppError('INVALID_IMAGE', 'Could not read image dimensions.', 400)
  }

  const id = randomUUID()
  const filename = `${id}${ext}`
  const filePath = join(getMediaDir(), filename)
  const thumbPath = join(getMediaThumbsDir(), `${id}.jpg`)

  // Re-encode safely (gif/webp → keep original bytes when possible for gif)
  if (ext === '.gif') {
    writeFileSync(filePath, input.data)
  } else if (ext === '.png') {
    await sharp(input.data).png().toFile(filePath)
  } else if (ext === '.webp') {
    await sharp(input.data).webp().toFile(filePath)
  } else {
    await sharp(input.data).jpeg({ quality: 92 }).toFile(filePath)
  }

  await sharp(filePath)
    .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbPath)

  const item: MediaItem = {
    id,
    filename,
    originalName: input.originalName || filename,
    mime: mime || `image/${ext.slice(1)}`,
    width: meta.width,
    height: meta.height,
    createdAt: new Date().toISOString()
  }

  const store = readMeta()
  store.items.push(item)
  writeMeta(store)

  return {
    ...item,
    url: `/api/media/${item.id}`,
    thumbnailUrl: `/api/media/${item.id}/thumb`
  }
}

export function deleteMediaItem(id: string): void {
  const store = readMeta()
  const item = store.items.find(entry => entry.id === id)
  if (!item) {
    throw new AppError('NOT_FOUND', 'Media item not found.', 404)
  }

  const filePath = getMediaFilePath(item)
  const thumbPath = getMediaThumbPath(item)
  if (existsSync(filePath)) unlinkSync(filePath)
  if (existsSync(thumbPath)) unlinkSync(thumbPath)

  writeMeta({ items: store.items.filter(entry => entry.id !== id) })
}

export function mimeForMediaItem(item: MediaItem): string {
  if (item.mime && ALLOWED_MEDIA_MIMES.has(item.mime)) return item.mime
  const ext = extname(item.filename).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/jpeg'
}
