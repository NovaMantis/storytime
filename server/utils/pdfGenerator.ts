import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { AppError } from './errors'
import { logInfo } from './logger'

function detectEmbedType(filename: string): 'png' | 'jpg' {
  const ext = filename.toLowerCase()
  if (ext.endsWith('.png')) return 'png'
  return 'jpg'
}

export async function generateProjectPdf(
  folderPath: string,
  imageOrder: string[]
): Promise<string> {
  const processedDir = join(folderPath, 'processed')
  const outputPath = join(folderPath, 'output.pdf')

  const pdf = await PDFDocument.create()
  let pageCount = 0

  for (const filename of imageOrder) {
    const imagePath = join(processedDir, filename)
    if (!existsSync(imagePath)) {
      continue
    }
    const bytes = readFileSync(imagePath)
    const embedType = detectEmbedType(filename)
    const image = embedType === 'png'
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes)

    const { width, height } = image.scale(1)
    const page = pdf.addPage([width, height])
    page.drawImage(image, { x: 0, y: 0, width, height })
    pageCount++
  }

  if (pageCount === 0) {
    throw new AppError('NO_IMAGES', 'No processed images found to include in PDF.', 400)
  }

  const pdfBytes = await pdf.save()
  writeFileSync(outputPath, pdfBytes)
  logInfo('Generated project PDF', { folderPath, pageCount })
  return outputPath
}
