import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import sharp from 'sharp'
import { AppError } from './errors'
import { resolveGoogleFontBytes } from './googleFonts'
import { logInfo } from './logger'
import {
  normalizeCrop,
  normalizeTextColor,
  pageImages,
  readManuscript,
  type Manuscript,
  type ManuscriptImage,
  type ManuscriptTextBox
} from './manuscript'
import {
  getMediaFilePath,
  getMediaItem
} from './mediaLibrary'

const PT_PER_IN = 72

function hexToRgb(hex: string): { r: number, g: number, b: number } {
  const normalized = normalizeTextColor(hex).slice(1)
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255
  }
}

function wrapLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        current = next
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }

  return lines
}

function drawAlignedText(
  page: PDFPage,
  lines: string[],
  box: ManuscriptTextBox,
  font: PDFFont,
  pageHeightPt: number
) {
  const fontSize = box.fontSizePt
  const lineHeight = fontSize * 1.35
  const boxX = box.x * PT_PER_IN
  const boxWidth = box.width * PT_PER_IN
  const boxTop = pageHeightPt - box.y * PT_PER_IN
  const boxBottom = pageHeightPt - (box.y + box.height) * PT_PER_IN
  const maxLines = Math.max(1, Math.floor((box.height * PT_PER_IN) / lineHeight))
  const visibleLines = lines.slice(0, maxLines)
  const { r, g, b } = hexToRgb(box.color)

  visibleLines.forEach((line, index) => {
    const textWidth = font.widthOfTextAtSize(line, fontSize)
    let x = boxX
    if (box.align === 'center') {
      x = boxX + (boxWidth - textWidth) / 2
    } else if (box.align === 'right') {
      x = boxX + boxWidth - textWidth
    }
    const y = boxTop - fontSize - index * lineHeight
    if (y < boxBottom) return
    page.drawText(line, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(r, g, b)
    })
  })
}

async function embedFontForFamily(
  pdf: PDFDocument,
  cache: Map<string, PDFFont>,
  family: string
): Promise<PDFFont> {
  const key = family.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached
  const bytes = await resolveGoogleFontBytes(family)
  const font = await pdf.embedFont(bytes, { subset: true })
  cache.set(key, font)
  return font
}

async function prepareImageBytes(imagePath: string, image: ManuscriptImage): Promise<Uint8Array> {
  const crop = normalizeCrop(image.crop)
  const isFullCrop = crop.left === 0 && crop.top === 0 && crop.width === 1 && crop.height === 1
  if (isFullCrop) {
    return new Uint8Array(readFileSync(imagePath))
  }

  const meta = await sharp(imagePath).metadata()
  if (!meta.width || !meta.height) {
    return new Uint8Array(readFileSync(imagePath))
  }

  const left = Math.round(crop.left * meta.width)
  const top = Math.round(crop.top * meta.height)
  const width = Math.max(1, Math.round(crop.width * meta.width))
  const height = Math.max(1, Math.round(crop.height * meta.height))
  const extractWidth = Math.min(width, meta.width - left)
  const extractHeight = Math.min(height, meta.height - top)

  return new Uint8Array(
    await sharp(imagePath)
      .extract({ left, top, width: extractWidth, height: extractHeight })
      .png()
      .toBuffer()
  )
}

export async function generateManuscriptPdf(
  folderPath: string,
  manuscript?: Manuscript
): Promise<string> {
  const layout = manuscript ?? readManuscript(folderPath)
  if (!layout || layout.pages.length === 0) {
    throw new AppError('NO_MANUSCRIPT', 'No manuscript found to export. Open the manuscript editor first.', 400)
  }

  const processedDir = join(folderPath, 'processed')
  const outputPath = join(folderPath, 'output.pdf')
  const pageWidthPt = layout.pageWidthIn * PT_PER_IN
  const pageHeightPt = layout.pageHeightIn * PT_PER_IN

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fontCache = new Map<string, PDFFont>()

  for (const pageLayout of layout.pages) {
    const page = pdf.addPage([pageWidthPt, pageHeightPt])
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt,
      color: rgb(1, 1, 1)
    })

    for (const imageLayout of pageImages(pageLayout)) {
      let imagePath: string | null = null
      if (imageLayout.source === 'global' && imageLayout.mediaId) {
        const item = getMediaItem(imageLayout.mediaId)
        if (item) {
          const path = getMediaFilePath(item)
          if (existsSync(path)) imagePath = path
        }
      } else if (imageLayout.filename) {
        const path = join(processedDir, imageLayout.filename)
        if (existsSync(path)) imagePath = path
      }
      if (!imagePath) continue

      const bytes = await prepareImageBytes(imagePath, {
        ...imageLayout,
        crop: normalizeCrop(imageLayout.crop)
      })
      const image = await pdf.embedPng(bytes)

      const width = imageLayout.width * PT_PER_IN
      const height = imageLayout.height * PT_PER_IN
      const x = imageLayout.x * PT_PER_IN
      const y = pageHeightPt - imageLayout.y * PT_PER_IN - height
      page.drawImage(image, { x, y, width, height })
    }

    for (const box of pageLayout.textBoxes) {
      if (!box.text?.trim()) continue
      const font = await embedFontForFamily(pdf, fontCache, box.fontFamily || layout.defaultFontFamily)
      const colorized = { ...box, color: normalizeTextColor(box.color) }
      const lines = wrapLines(colorized.text, font, colorized.fontSizePt, colorized.width * PT_PER_IN)
      drawAlignedText(page, lines, colorized, font, pageHeightPt)
    }
  }

  const pdfBytes = await pdf.save()
  writeFileSync(outputPath, pdfBytes)
  logInfo('Generated manuscript PDF', { folderPath, pageCount: layout.pages.length })
  return outputPath
}
