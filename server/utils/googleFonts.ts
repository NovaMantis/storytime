import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDataDir } from './config'
import { AppError } from './errors'
import { logInfo } from './logger'

function fontSlug(family: string): string {
  return family
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getFontsDir(): string {
  const dir = join(getDataDir(), 'fonts')
  mkdirSync(dir, { recursive: true })
  return dir
}

function cachePathForFamily(family: string): string {
  return join(getFontsDir(), `${fontSlug(family)}-400.ttf`)
}

async function fetchCss(family: string, userAgent: string): Promise<string> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.trim())}:wght@400&display=swap`
  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent }
  })
  if (!response.ok) {
    throw new AppError(
      'FONT_FETCH_FAILED',
      `Could not load Google Font CSS for "${family}" (${response.status}).`,
      400
    )
  }
  return response.text()
}

function extractFontUrl(css: string): string | null {
  const match = css.match(/url\((https:\/\/[^)]+\.(?:ttf|otf|woff2|woff))\)/i)
  return match?.[1] ?? null
}

async function fetchFontsourceTtf(family: string): Promise<Uint8Array | null> {
  const slug = fontSlug(family)
  const url = `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-400-normal.ttf`
  const response = await fetch(url)
  if (!response.ok) return null
  return new Uint8Array(await response.arrayBuffer())
}

/**
 * Resolve a Google Font family to TTF/OTF bytes, caching under data/fonts/.
 */
export async function resolveGoogleFontBytes(family: string): Promise<Uint8Array> {
  const trimmed = family.trim()
  if (!trimmed) {
    throw new AppError('INVALID_FONT', 'Font family is required.', 400)
  }

  const cached = cachePathForFamily(trimmed)
  if (existsSync(cached)) {
    return new Uint8Array(readFileSync(cached))
  }

  // IE UA tends to return TTF urls from Google Fonts CSS
  const ieUa = 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)'
  let bytes: Uint8Array | null = null

  try {
    const css = await fetchCss(trimmed, ieUa)
    const fontUrl = extractFontUrl(css)
    if (fontUrl && /\.(ttf|otf)(\?|$)/i.test(fontUrl)) {
      const response = await fetch(fontUrl)
      if (response.ok) {
        bytes = new Uint8Array(await response.arrayBuffer())
      }
    }
  } catch {
    // fall through to fontsource
  }

  if (!bytes) {
    bytes = await fetchFontsourceTtf(trimmed)
  }

  if (!bytes) {
    throw new AppError(
      'FONT_FETCH_FAILED',
      `Could not download a TTF/OTF file for Google Font "${trimmed}". Check the family name.`,
      400
    )
  }

  writeFileSync(cached, bytes)
  logInfo('Cached Google Font', { family: trimmed, path: cached })
  return bytes
}
