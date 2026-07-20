import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { AppError } from './errors'
import { getManuscriptDefaultFont } from './settings'
import { readExtractedText } from './textExtractor'

export const MANUSCRIPT_PAGE_WIDTH_IN = 8.155
export const MANUSCRIPT_PAGE_HEIGHT_IN = 10.25
export const MANUSCRIPT_FILENAME = 'manuscript.json'
export const MANUSCRIPT_ORIGINAL_FILENAME = 'manuscript.original.json'

export type TextAlign = 'left' | 'center' | 'right'

/** Normalized crop rect within the source image (0–1). Full image = 0,0,1,1 */
export interface ManuscriptImageCrop {
  left: number
  top: number
  width: number
  height: number
}

export type ManuscriptImageSource = 'project' | 'global'

export interface ManuscriptImage {
  id: string
  /** Where the bitmap lives. Missing on older files → treated as project. */
  source?: ManuscriptImageSource
  /** Processed filename when source is project (or legacy). */
  filename?: string
  /** Global media library id when source is global. */
  mediaId?: string
  x: number
  y: number
  width: number
  height: number
  crop: ManuscriptImageCrop
}

export interface ManuscriptTextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontFamily: string
  fontSizePt: number
  align: TextAlign
  /** CSS hex color, default black */
  color: string
}

export const DEFAULT_TEXT_COLOR = '#000000'
export const FULL_IMAGE_CROP: ManuscriptImageCrop = {
  left: 0,
  top: 0,
  width: 1,
  height: 1
}

export function normalizeCrop(crop?: Partial<ManuscriptImageCrop> | null): ManuscriptImageCrop {
  const left = clamp01(Number(crop?.left) || 0)
  const top = clamp01(Number(crop?.top) || 0)
  const width = Math.min(1 - left, Math.max(0.05, Number(crop?.width) || 1))
  const height = Math.min(1 - top, Math.max(0.05, Number(crop?.height) || 1))
  return { left, top, width, height }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function normalizeTextColor(color?: string | null): string {
  const value = (color || DEFAULT_TEXT_COLOR).trim()
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, a, b, c] = value
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase()
  }
  return DEFAULT_TEXT_COLOR
}

export interface ManuscriptPage {
  id: string
  background: 'white'
  /** @deprecated Prefer `images`. Kept for reading older manuscripts. */
  image?: ManuscriptImage
  /** Image layers, drawn under text (first = bottom). */
  images?: ManuscriptImage[]
  textBoxes: ManuscriptTextBox[]
}

export interface Manuscript {
  version: 1
  pageWidthIn: number
  pageHeightIn: number
  defaultFontFamily: string
  pages: ManuscriptPage[]
}

const PAGE_MARGIN_IN = 0.4
const BOTTOM_TEXT_HEIGHT_IN = 1.6
const BOTTOM_TEXT_GAP_IN = 0.25
const DEFAULT_BODY_FONT_SIZE_PT = 14
const DEFAULT_TITLE_FONT_SIZE_PT = 28

export function getManuscriptPath(folderPath: string): string {
  return join(folderPath, MANUSCRIPT_FILENAME)
}

export function getManuscriptOriginalPath(folderPath: string): string {
  return join(folderPath, MANUSCRIPT_ORIGINAL_FILENAME)
}

export function manuscriptExists(folderPath: string): boolean {
  return existsSync(getManuscriptPath(folderPath))
}

export function originalManuscriptExists(folderPath: string): boolean {
  return existsSync(getManuscriptOriginalPath(folderPath))
}

export function writeManuscriptOriginal(folderPath: string, manuscript: Manuscript): void {
  const normalized = normalizeManuscript(manuscript)
  const path = getManuscriptOriginalPath(folderPath)
  if (existsSync(path)) return
  writeFileSync(path, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
}

export function readManuscriptOriginal(folderPath: string): Manuscript | null {
  const path = getManuscriptOriginalPath(folderPath)
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Manuscript
  return normalizeManuscript(raw)
}

export function resetManuscriptToOriginal(folderPath: string): Manuscript {
  const original = readManuscriptOriginal(folderPath)
  if (!original) {
    throw new AppError(
      'NO_ORIGINAL',
      'No original manuscript snapshot exists for this project.',
      404
    )
  }
  writeManuscript(folderPath, original)
  return original
}

export function pageImages(page: ManuscriptPage): ManuscriptImage[] {
  const normalizeOne = (img: ManuscriptImage): ManuscriptImage => {
    const source: ManuscriptImageSource = img.source === 'global' ? 'global' : 'project'
    return {
      ...img,
      id: img.id || randomUUID(),
      source,
      filename: source === 'project' ? (img.filename || '') : img.filename,
      mediaId: source === 'global' ? (img.mediaId || '') : img.mediaId,
      crop: normalizeCrop(img.crop)
    }
  }

  if (page.images?.length) {
    return page.images.map(normalizeOne)
  }
  if (page.image) {
    return [normalizeOne(page.image)]
  }
  return []
}

export function normalizeManuscript(manuscript: Manuscript): Manuscript {
  return {
    ...manuscript,
    pages: manuscript.pages.map(page => ({
      id: page.id,
      background: 'white',
      images: pageImages(page),
      textBoxes: (page.textBoxes || []).map(box => ({
        ...box,
        color: normalizeTextColor(box.color),
        align: box.align === 'left' || box.align === 'right' ? box.align : 'center'
      }))
    }))
  }
}

export function readManuscript(folderPath: string): Manuscript | null {
  const path = getManuscriptPath(folderPath)
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Manuscript
  return normalizeManuscript(raw)
}

export function writeManuscript(folderPath: string, manuscript: Manuscript): void {
  const normalized = normalizeManuscript(manuscript)
  writeFileSync(getManuscriptPath(folderPath), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
}

function newId(): string {
  return randomUUID()
}

function blankPage(): ManuscriptPage {
  return {
    id: newId(),
    background: 'white',
    images: [],
    textBoxes: []
  }
}

function createTextBox(
  partial: Omit<ManuscriptTextBox, 'id' | 'align' | 'color'> & { align?: TextAlign, color?: string }
): ManuscriptTextBox {
  return {
    id: newId(),
    align: 'center',
    ...partial,
    color: normalizeTextColor(partial.color)
  }
}

async function getImageSizeInches(
  folderPath: string,
  filename: string
): Promise<{ widthIn: number, heightIn: number } | null> {
  const imagePath = join(folderPath, 'processed', filename)
  if (!existsSync(imagePath)) return null
  const meta = await sharp(imagePath).metadata()
  if (!meta.width || !meta.height) return null
  // Assume 150 DPI for layout defaults when EXIF DPI is missing
  const dpi = 150
  return {
    widthIn: meta.width / dpi,
    heightIn: meta.height / dpi
  }
}

function fitImageInBox(
  imageWidthIn: number,
  imageHeightIn: number,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number
): Omit<ManuscriptImage, 'filename' | 'id' | 'source' | 'mediaId'> {
  const scale = Math.min(boxWidth / imageWidthIn, boxHeight / imageHeightIn, 1)
  const width = imageWidthIn * scale
  const height = imageHeightIn * scale
  return {
    x: boxX + (boxWidth - width) / 2,
    y: boxY + (boxHeight - height) / 2,
    width,
    height,
    crop: { ...FULL_IMAGE_CROP }
  }
}

async function centeredImagePlacement(
  folderPath: string,
  filename: string,
  options?: { reserveBottomText?: boolean }
): Promise<ManuscriptImage | undefined> {
  const size = await getImageSizeInches(folderPath, filename)
  const pageW = MANUSCRIPT_PAGE_WIDTH_IN
  const pageH = MANUSCRIPT_PAGE_HEIGHT_IN
  const boxX = PAGE_MARGIN_IN
  const boxY = PAGE_MARGIN_IN
  const boxWidth = pageW - PAGE_MARGIN_IN * 2
  const reserved = options?.reserveBottomText
    ? BOTTOM_TEXT_HEIGHT_IN + BOTTOM_TEXT_GAP_IN
    : 0
  const boxHeight = pageH - PAGE_MARGIN_IN * 2 - reserved

  if (!size) {
    return {
      id: newId(),
      source: 'project',
      filename,
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: Math.min(boxHeight, boxWidth * 1.25),
      crop: { ...FULL_IMAGE_CROP }
    }
  }

  const fitted = fitImageInBox(size.widthIn, size.heightIn, boxX, boxY, boxWidth, boxHeight)
  return { ...fitted, id: newId(), source: 'project', filename }
}

function bottomTextBox(fontFamily: string, text: string): ManuscriptTextBox {
  return createTextBox({
    text,
    x: PAGE_MARGIN_IN,
    y: MANUSCRIPT_PAGE_HEIGHT_IN - PAGE_MARGIN_IN - BOTTOM_TEXT_HEIGHT_IN,
    width: MANUSCRIPT_PAGE_WIDTH_IN - PAGE_MARGIN_IN * 2,
    height: BOTTOM_TEXT_HEIGHT_IN,
    fontFamily,
    fontSizePt: DEFAULT_BODY_FONT_SIZE_PT
  })
}

function titleTextBox(fontFamily: string, text: string): ManuscriptTextBox {
  const width = MANUSCRIPT_PAGE_WIDTH_IN - PAGE_MARGIN_IN * 2
  const height = 3.5
  return createTextBox({
    text,
    x: PAGE_MARGIN_IN,
    y: (MANUSCRIPT_PAGE_HEIGHT_IN - height) / 2,
    width,
    height,
    fontFamily,
    fontSizePt: DEFAULT_TITLE_FONT_SIZE_PT
  })
}

export async function createDefaultManuscript(
  folderPath: string,
  imageOrder: string[]
): Promise<Manuscript> {
  const fontFamily = getManuscriptDefaultFont()
  const existingImages = imageOrder.filter(filename =>
    existsSync(join(folderPath, 'processed', filename))
  )

  const pages: ManuscriptPage[] = []

  if (existingImages.length === 0) {
    pages.push(blankPage())
  } else {
    const first = existingImages[0]!
    const firstText = readExtractedText(folderPath, first)?.trim() || ''

    const firstImage = await centeredImagePlacement(folderPath, first)
    // Page 1: first image, no text
    pages.push({
      id: newId(),
      background: 'white',
      images: firstImage ? [firstImage] : [],
      textBoxes: []
    })

    // Page 2: blank
    pages.push(blankPage())

    // Page 3: title page from image 1 text
    pages.push({
      id: newId(),
      background: 'white',
      images: [],
      textBoxes: [titleTextBox(fontFamily, firstText)]
    })

    // Remaining images
    for (const filename of existingImages.slice(1)) {
      const text = readExtractedText(folderPath, filename)?.trim() || ''
      const hasText = text.length > 0
      const image = await centeredImagePlacement(folderPath, filename, { reserveBottomText: hasText })
      pages.push({
        id: newId(),
        background: 'white',
        images: image ? [image] : [],
        textBoxes: hasText ? [bottomTextBox(fontFamily, text)] : []
      })
    }
  }

  const manuscript: Manuscript = {
    version: 1,
    pageWidthIn: MANUSCRIPT_PAGE_WIDTH_IN,
    pageHeightIn: MANUSCRIPT_PAGE_HEIGHT_IN,
    defaultFontFamily: fontFamily,
    pages
  }

  writeManuscript(folderPath, manuscript)
  writeManuscriptOriginal(folderPath, manuscript)
  return manuscript
}

export async function getOrCreateManuscript(
  folderPath: string,
  imageOrder: string[]
): Promise<Manuscript> {
  const existing = readManuscript(folderPath)
  if (existing) {
    // One-time backfill for manuscripts created before original snapshots existed
    if (!originalManuscriptExists(folderPath)) {
      writeManuscriptOriginal(folderPath, existing)
    }
    return existing
  }
  return createDefaultManuscript(folderPath, imageOrder)
}

export function createBlankManuscriptPage(): ManuscriptPage {
  return blankPage()
}

export function createDefaultTextBox(fontFamily: string): ManuscriptTextBox {
  return bottomTextBox(fontFamily, '')
}
