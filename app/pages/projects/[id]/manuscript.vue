<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type TextAlign = 'left' | 'center' | 'right'
type CropCorner = 'nw' | 'ne' | 'sw' | 'se'

interface ManuscriptImageCrop {
  left: number
  top: number
  width: number
  height: number
}

interface ManuscriptImage {
  id: string
  source?: 'project' | 'global'
  filename?: string
  mediaId?: string
  x: number
  y: number
  width: number
  height: number
  crop: ManuscriptImageCrop
}

interface ManuscriptTextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontFamily: string
  fontSizePt: number
  align: TextAlign
  color: string
}

interface ManuscriptPage {
  id: string
  background: 'white'
  image?: ManuscriptImage
  images?: ManuscriptImage[]
  textBoxes: ManuscriptTextBox[]
}

interface Manuscript {
  version: 1
  pageWidthIn: number
  pageHeightIn: number
  defaultFontFamily: string
  pages: ManuscriptPage[]
}

interface ManuscriptResponse {
  projectId: string
  manuscript: Manuscript
  hasOriginal: boolean
  imageUrls: Record<string, string>
  thumbnailUrls: Record<string, string>
}

interface GlobalMediaItem {
  id: string
  originalName: string
  width: number
  height: number
  url: string
  thumbnailUrl: string
}

type MediaPickerTab = 'project' | 'global'

type Selection =
  | { pageId: string, kind: 'image', imageId: string }
  | { pageId: string, kind: 'text', textBoxId: string }

type DragMode = 'move' | 'resize' | 'crop-move' | 'crop-resize'

interface DragState {
  mode: DragMode
  pageId: string
  kind: 'image' | 'text'
  imageId?: string
  textBoxId?: string
  cropCorner?: CropCorner
  startX: number
  startY: number
  origX: number
  origY: number
  origW: number
  origH: number
}

const PAGE_DISPLAY_WIDTH_PX = 420
const MIN_ELEMENT_IN = 0.4
const MIN_CROP = 0.05
const DEFAULT_TEXT_COLOR = '#000000'
const FULL_CROP: ManuscriptImageCrop = { left: 0, top: 0, width: 1, height: 1 }
const MAX_HISTORY = 50

const route = useRoute()
const toast = useToast()
const { api } = useApi()

const { data, refresh, pending, error } = await useFetch<ManuscriptResponse>(
  () => `/api/projects/${route.params.id}/manuscript`
)

const manuscript = ref<Manuscript | null>(null)
const imageUrls = ref<Record<string, string>>({})
const thumbnailUrls = ref<Record<string, string>>({})
const hasOriginal = ref(false)
const imageNaturalSize = ref<Record<string, { w: number, h: number }>>({})
const selection = ref<Selection | null>(null)
const saving = ref(false)
const generatingPdf = ref(false)
const resetting = ref(false)
const dirty = ref(false)
const drag = ref<DragState | null>(null)
const moveTargetPage = ref<number | undefined>(undefined)
const cropMode = ref<{ pageId: string, imageId: string } | null>(null)
const draftCrop = ref<ManuscriptImageCrop | null>(null)
const history = ref<string[]>([])
const mediaPickerOpen = ref(false)
const mediaPickerPageId = ref<string | null>(null)
const mediaPickerTab = ref<MediaPickerTab>('project')
const addingImage = ref(false)
const resetConfirmOpen = ref(false)

const { data: globalMediaData, refresh: refreshGlobalMedia } = await useFetch<{ items: GlobalMediaItem[] }>(
  '/api/media',
  { immediate: false }
)

function normalizeCrop(crop?: Partial<ManuscriptImageCrop> | null): ManuscriptImageCrop {
  const left = Math.min(1, Math.max(0, Number(crop?.left) || 0))
  const top = Math.min(1, Math.max(0, Number(crop?.top) || 0))
  const width = Math.min(1 - left, Math.max(MIN_CROP, Number(crop?.width) || 1))
  const height = Math.min(1 - top, Math.max(MIN_CROP, Number(crop?.height) || 1))
  return { left, top, width, height }
}

function pageImagesList(page: ManuscriptPage): ManuscriptImage[] {
  if (page.images?.length) {
    return page.images.map(img => ({
      ...img,
      id: img.id || crypto.randomUUID(),
      source: img.source === 'global' ? 'global' : 'project',
      crop: normalizeCrop(img.crop)
    }))
  }
  if (page.image) {
    return [{
      ...page.image,
      id: page.image.id || crypto.randomUUID(),
      source: page.image.source === 'global' ? 'global' : 'project',
      crop: normalizeCrop(page.image.crop)
    }]
  }
  return []
}

function migrateManuscript(raw: Manuscript): Manuscript {
  return {
    ...raw,
    pages: raw.pages.map(page => ({
      id: page.id,
      background: 'white',
      images: pageImagesList(page),
      textBoxes: (page.textBoxes || []).map(box => ({
        ...box,
        color: box.color || DEFAULT_TEXT_COLOR
      }))
    }))
  }
}

function ensurePageImages(page: ManuscriptPage): ManuscriptImage[] {
  if (!page.images) page.images = pageImagesList(page)
  return page.images
}

watch(data, (value) => {
  if (!value) return
  manuscript.value = migrateManuscript(structuredClone(toRaw(value.manuscript)))
  imageUrls.value = { ...value.imageUrls }
  thumbnailUrls.value = { ...(value.thumbnailUrls || {}) }
  hasOriginal.value = Boolean(value.hasOriginal)
  dirty.value = false
  history.value = []
  cropMode.value = null
  draftCrop.value = null
}, { immediate: true })

const pageWidthIn = computed(() => manuscript.value?.pageWidthIn ?? 8.155)
const pageHeightIn = computed(() => manuscript.value?.pageHeightIn ?? 10.25)
const scale = computed(() => PAGE_DISPLAY_WIDTH_PX / pageWidthIn.value)
const pageDisplayHeight = computed(() => pageHeightIn.value * scale.value)

const fontFamilies = computed(() => {
  if (!manuscript.value) return [] as string[]
  const set = new Set<string>([manuscript.value.defaultFontFamily])
  for (const page of manuscript.value.pages) {
    for (const box of page.textBoxes) {
      if (box.fontFamily) set.add(box.fontFamily)
    }
  }
  return [...set]
})

const googleFontsHref = computed(() => {
  if (!fontFamilies.value.length) return ''
  const families = fontFamilies.value
    .map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;700`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
})

useHead(() => ({
  link: googleFontsHref.value
    ? [{ rel: 'stylesheet', href: googleFontsHref.value }]
    : []
}))

const selectedPage = computed(() => {
  if (!manuscript.value || !selection.value) return null
  return manuscript.value.pages.find(p => p.id === selection.value!.pageId) ?? null
})

const selectedImage = computed(() => {
  const sel = selection.value
  if (!selectedPage.value || !sel || sel.kind !== 'image') return null
  return ensurePageImages(selectedPage.value).find(img => img.id === sel.imageId) ?? null
})

const selectedTextBox = computed(() => {
  const sel = selection.value
  if (!selectedPage.value || !sel || sel.kind !== 'text') return null
  return selectedPage.value.textBoxes.find(b => b.id === sel.textBoxId) ?? null
})

const pageOptions = computed(() =>
  (manuscript.value?.pages || []).map((_, index) => ({
    label: `Page ${index + 1}`,
    value: index + 1
  }))
)

const projectPickerItems = computed(() =>
  Object.keys(imageUrls.value).map(filename => ({
    key: `project:${filename}`,
    source: 'project' as const,
    filename,
    label: filename,
    thumbUrl: thumbnailUrls.value[filename] || imageUrls.value[filename]!,
    fullUrl: imageUrls.value[filename]!
  }))
)

const globalPickerItems = computed(() =>
  (globalMediaData.value?.items || []).map(item => ({
    key: `global:${item.id}`,
    source: 'global' as const,
    mediaId: item.id,
    label: item.originalName,
    thumbUrl: item.thumbnailUrl,
    fullUrl: item.url,
    width: item.width,
    height: item.height
  }))
)

const canUndo = computed(() => history.value.length > 0)

function imageDisplayUrl(image: ManuscriptImage): string {
  if (image.source === 'global' && image.mediaId) {
    return `/api/media/${image.mediaId}`
  }
  if (image.filename && imageUrls.value[image.filename]) {
    return imageUrls.value[image.filename]!
  }
  return ''
}

function imageSizeKey(image: ManuscriptImage): string {
  if (image.source === 'global' && image.mediaId) return `global:${image.mediaId}`
  return `project:${image.filename || ''}`
}

function markDirty() {
  dirty.value = true
}

function newId() {
  return crypto.randomUUID()
}

function pushHistory() {
  if (!manuscript.value) return
  history.value.push(JSON.stringify(toRaw(manuscript.value)))
  if (history.value.length > MAX_HISTORY) history.value.shift()
}

function undo() {
  const prev = history.value.pop()
  if (!prev) return
  manuscript.value = migrateManuscript(JSON.parse(prev))
  selection.value = null
  cropMode.value = null
  draftCrop.value = null
  markDirty()
}

function selectImage(pageId: string, imageId: string) {
  selection.value = { pageId, kind: 'image', imageId }
}

function selectText(pageId: string, textBoxId: string) {
  selection.value = { pageId, kind: 'text', textBoxId }
  if (cropMode.value) cancelCrop()
}

function clearSelection() {
  selection.value = null
  if (cropMode.value) cancelCrop()
}

function pageIndex(pageId: string) {
  return manuscript.value?.pages.findIndex(p => p.id === pageId) ?? -1
}

function findImage(page: ManuscriptPage, imageId: string) {
  return ensurePageImages(page).find(img => img.id === imageId)
}

function movePage(pageId: string, direction: -1 | 1) {
  if (!manuscript.value) return
  const index = pageIndex(pageId)
  const next = index + direction
  if (index < 0 || next < 0 || next >= manuscript.value.pages.length) return
  pushHistory()
  const pages = [...manuscript.value.pages]
  const [item] = pages.splice(index, 1)
  pages.splice(next, 0, item!)
  manuscript.value.pages = pages
  markDirty()
}

function deletePage(pageId: string) {
  if (!manuscript.value) return
  if (manuscript.value.pages.length <= 1) {
    toast.add({ title: 'Keep at least one page', color: 'warning' })
    return
  }
  pushHistory()
  manuscript.value.pages = manuscript.value.pages.filter(p => p.id !== pageId)
  if (selection.value?.pageId === pageId) clearSelection()
  markDirty()
}

function insertBlankAt(index: number) {
  if (!manuscript.value) return
  pushHistory()
  manuscript.value.pages.splice(index, 0, {
    id: newId(),
    background: 'white',
    images: [],
    textBoxes: []
  })
  markDirty()
}

function addTextBox(pageId: string) {
  if (!manuscript.value) return
  const page = manuscript.value.pages.find(p => p.id === pageId)
  if (!page) return
  pushHistory()
  const box: ManuscriptTextBox = {
    id: newId(),
    text: '',
    x: 0.4,
    y: pageHeightIn.value - 0.4 - 1.6,
    width: pageWidthIn.value - 0.8,
    height: 1.6,
    fontFamily: manuscript.value.defaultFontFamily,
    fontSizePt: 14,
    align: 'center',
    color: DEFAULT_TEXT_COLOR
  }
  page.textBoxes.push(box)
  selectText(pageId, box.id)
  markDirty()
}

function createImageLayerFromSize(
  opts: {
    source: 'project' | 'global'
    filename?: string
    mediaId?: string
    naturalW: number
    naturalH: number
  }
): ManuscriptImage {
  const margin = 0.4
  const boxW = pageWidthIn.value - margin * 2
  const boxH = pageHeightIn.value - margin * 2
  const aspect = opts.naturalW / opts.naturalH
  let width: number
  let height: number
  if (boxW / boxH > aspect) {
    height = Math.min(boxH, boxW / aspect)
    width = height * aspect
  } else {
    width = Math.min(boxW, boxH * aspect)
    height = width / aspect
  }
  return {
    id: newId(),
    source: opts.source,
    filename: opts.filename,
    mediaId: opts.mediaId,
    x: (pageWidthIn.value - width) / 2,
    y: (pageHeightIn.value - height) / 2,
    width,
    height,
    crop: { ...FULL_CROP }
  }
}

async function prefetchImageSize(url: string): Promise<{ w: number, h: number }> {
  const img = new Image()
  img.src = url
  await img.decode()
  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error('Could not read image size')
  }
  return { w: img.naturalWidth, h: img.naturalHeight }
}

async function openAddImage(pageId: string) {
  mediaPickerPageId.value = pageId
  mediaPickerTab.value = 'project'
  mediaPickerOpen.value = true
  await refreshGlobalMedia()
}

function closeMediaPicker() {
  mediaPickerOpen.value = false
  mediaPickerPageId.value = null
}

async function pickProjectImage(filename: string) {
  if (!manuscript.value || !mediaPickerPageId.value) return
  const page = manuscript.value.pages.find(p => p.id === mediaPickerPageId.value)
  if (!page) return
  const url = imageUrls.value[filename]
  if (!url) return

  addingImage.value = true
  try {
    const size = await prefetchImageSize(url)
    imageNaturalSize.value[`project:${filename}`] = size
    pushHistory()
    const images = ensurePageImages(page)
    const layer = createImageLayerFromSize({
      source: 'project',
      filename,
      naturalW: size.w,
      naturalH: size.h
    })
    images.push(layer)
    page.images = images
    selectImage(page.id, layer.id)
    closeMediaPicker()
    markDirty()
  } catch {
    toast.add({ title: 'Could not load image dimensions', color: 'error' })
  } finally {
    addingImage.value = false
  }
}

async function pickGlobalImage(item: { mediaId: string, fullUrl: string, width?: number, height?: number }) {
  if (!manuscript.value || !mediaPickerPageId.value) return
  const page = manuscript.value.pages.find(p => p.id === mediaPickerPageId.value)
  if (!page) return

  addingImage.value = true
  try {
    let size = item.width && item.height
      ? { w: item.width, h: item.height }
      : await prefetchImageSize(item.fullUrl)
    imageNaturalSize.value[`global:${item.mediaId}`] = size
    pushHistory()
    const images = ensurePageImages(page)
    const layer = createImageLayerFromSize({
      source: 'global',
      mediaId: item.mediaId,
      naturalW: size.w,
      naturalH: size.h
    })
    images.push(layer)
    page.images = images
    selectImage(page.id, layer.id)
    closeMediaPicker()
    markDirty()
  } catch {
    toast.add({ title: 'Could not load image dimensions', color: 'error' })
  } finally {
    addingImage.value = false
  }
}

async function resetManuscript() {
  resetting.value = true
  try {
    const result = await api<{ manuscript: Manuscript }>(
      `/api/projects/${route.params.id}/manuscript/reset`,
      { method: 'POST' }
    )
    manuscript.value = migrateManuscript(structuredClone(result.manuscript))
    history.value = []
    selection.value = null
    cropMode.value = null
    draftCrop.value = null
    dirty.value = false
    resetConfirmOpen.value = false
    await refresh()
    toast.add({ title: 'Manuscript reset to original', color: 'success' })
  } finally {
    resetting.value = false
  }
}

function deleteSelectedElement() {
  if (!manuscript.value || !selection.value) return
  const sel = selection.value
  const page = manuscript.value.pages.find(p => p.id === sel.pageId)
  if (!page) return
  pushHistory()
  if (sel.kind === 'image') {
    page.images = ensurePageImages(page).filter(img => img.id !== sel.imageId)
  } else {
    page.textBoxes = page.textBoxes.filter(b => b.id !== sel.textBoxId)
  }
  clearSelection()
  markDirty()
}

function moveTextToPage() {
  if (!manuscript.value || !selection.value || selection.value.kind !== 'text') return
  if (!moveTargetPage.value) return
  const sel = selection.value
  const textBoxId = sel.textBoxId
  const targetIndex = moveTargetPage.value - 1
  const sourceIndex = pageIndex(sel.pageId)
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= manuscript.value.pages.length) return
  if (sourceIndex === targetIndex) return

  pushHistory()
  const source = manuscript.value.pages[sourceIndex]!
  const target = manuscript.value.pages[targetIndex]!
  const boxIndex = source.textBoxes.findIndex(b => b.id === textBoxId)
  if (boxIndex < 0) return
  const [box] = source.textBoxes.splice(boxIndex, 1)
  target.textBoxes.push(box!)
  selection.value = { pageId: target.id, kind: 'text', textBoxId: box!.id }
  moveTargetPage.value = undefined
  markDirty()
  toast.add({ title: `Moved to page ${targetIndex + 1}`, color: 'success' })
}

function alignSelected(axis: 'horizontal' | 'vertical') {
  if (!manuscript.value || !selection.value || !selectedPage.value) return
  pushHistory()
  if (selection.value.kind === 'image' && selectedImage.value) {
    if (axis === 'horizontal') {
      selectedImage.value.x = (pageWidthIn.value - selectedImage.value.width) / 2
    } else {
      selectedImage.value.y = (pageHeightIn.value - selectedImage.value.height) / 2
    }
  } else if (selection.value.kind === 'text' && selectedTextBox.value) {
    if (axis === 'horizontal') {
      selectedTextBox.value.x = (pageWidthIn.value - selectedTextBox.value.width) / 2
    } else {
      selectedTextBox.value.y = (pageHeightIn.value - selectedTextBox.value.height) / 2
    }
  }
  markDirty()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function rememberNaturalSize(image: ManuscriptImage, event: Event) {
  const img = event.target as HTMLImageElement
  if (!img.naturalWidth || !img.naturalHeight) return
  imageNaturalSize.value[imageSizeKey(image)] = { w: img.naturalWidth, h: img.naturalHeight }
}

function cropVisualAspect(image: ManuscriptImage, crop: ManuscriptImageCrop): number {
  const c = normalizeCrop(crop)
  const nat = imageNaturalSize.value[imageSizeKey(image)]
  if (!nat) return c.width / c.height
  return (c.width * nat.w) / (c.height * nat.h)
}

function croppedImageStyle(crop: ManuscriptImageCrop) {
  const c = normalizeCrop(crop)
  return {
    width: `${100 / c.width}%`,
    height: `${100 / c.height}%`,
    marginLeft: `${(-c.left / c.width) * 100}%`,
    marginTop: `${(-c.top / c.height) * 100}%`,
    maxWidth: 'none',
    objectFit: 'fill' as const
  }
}

function beginCrop() {
  if (!selectedPage.value || !selectedImage.value) return
  cropMode.value = { pageId: selectedPage.value.id, imageId: selectedImage.value.id }
  draftCrop.value = normalizeCrop(selectedImage.value.crop)
}

function cancelCrop() {
  cropMode.value = null
  draftCrop.value = null
}

function applyCrop() {
  if (!manuscript.value || !cropMode.value || !draftCrop.value) return
  const page = manuscript.value.pages.find(p => p.id === cropMode.value!.pageId)
  if (!page) return
  const image = findImage(page, cropMode.value.imageId)
  if (!image) return
  pushHistory()
  const crop = normalizeCrop(draftCrop.value)
  image.crop = crop
  const aspect = cropVisualAspect(image, crop)
  const nextHeight = image.width / aspect
  if (image.y + nextHeight > pageHeightIn.value) {
    image.y = Math.max(0, pageHeightIn.value - nextHeight)
  }
  image.height = Math.min(nextHeight, pageHeightIn.value - image.y)
  cropMode.value = null
  draftCrop.value = null
  markDirty()
}

function resetCrop() {
  if (!selectedImage.value) return
  pushHistory()
  selectedImage.value.crop = { ...FULL_CROP }
  const aspect = cropVisualAspect(selectedImage.value, FULL_CROP)
  const nextHeight = selectedImage.value.width / aspect
  if (selectedImage.value.y + nextHeight > pageHeightIn.value) {
    selectedImage.value.y = Math.max(0, pageHeightIn.value - nextHeight)
  }
  selectedImage.value.height = Math.min(nextHeight, pageHeightIn.value - selectedImage.value.y)
  if (cropMode.value?.imageId === selectedImage.value.id) {
    draftCrop.value = { ...FULL_CROP }
  }
  markDirty()
}

function isCropping(pageId: string, imageId: string) {
  return cropMode.value?.pageId === pageId && cropMode.value?.imageId === imageId
}

function startDrag(
  event: PointerEvent,
  mode: DragMode,
  pageId: string,
  kind: 'image' | 'text',
  opts?: { imageId?: string, textBoxId?: string, cropCorner?: CropCorner }
) {
  if (!manuscript.value) return
  const page = manuscript.value.pages.find(p => p.id === pageId)
  if (!page) return

  let origX = 0
  let origY = 0
  let origW = 0
  let origH = 0

  if (kind === 'image' && opts?.imageId) {
    const image = findImage(page, opts.imageId)
    if (!image) return
    selectImage(pageId, opts.imageId)
    if (mode === 'crop-move' || mode === 'crop-resize') {
      const crop = normalizeCrop(draftCrop.value || image.crop)
      origX = crop.left
      origY = crop.top
      origW = crop.width
      origH = crop.height
    } else {
      origX = image.x
      origY = image.y
      origW = image.width
      origH = image.height
      if (mode === 'move' || mode === 'resize') pushHistory()
    }
  } else if (kind === 'text' && opts?.textBoxId) {
    const box = page.textBoxes.find(b => b.id === opts.textBoxId)
    if (!box) return
    selectText(pageId, opts.textBoxId)
    origX = box.x
    origY = box.y
    origW = box.width
    origH = box.height
    if (mode === 'move' || mode === 'resize') pushHistory()
  } else {
    return
  }

  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  drag.value = {
    mode,
    pageId,
    kind,
    imageId: opts?.imageId,
    textBoxId: opts?.textBoxId,
    cropCorner: opts?.cropCorner,
    startX: event.clientX,
    startY: event.clientY,
    origX,
    origY,
    origW,
    origH
  }
}

function onPointerMove(event: PointerEvent) {
  if (!drag.value || !manuscript.value) return
  const page = manuscript.value.pages.find(p => p.id === drag.value!.pageId)
  if (!page) return

  const dx = (event.clientX - drag.value.startX) / scale.value
  const dy = (event.clientY - drag.value.startY) / scale.value

  if (drag.value.mode === 'crop-move' || drag.value.mode === 'crop-resize') {
    if (!drag.value.imageId || !draftCrop.value) return
    const image = findImage(page, drag.value.imageId)
    if (!image) return
    const frameW = image.width
    const frameH = image.height
    const dLeft = dx / frameW
    const dTop = dy / frameH

    if (drag.value.mode === 'crop-move') {
      draftCrop.value = {
        left: clamp(drag.value.origX + dLeft, 0, 1 - drag.value.origW),
        top: clamp(drag.value.origY + dTop, 0, 1 - drag.value.origH),
        width: drag.value.origW,
        height: drag.value.origH
      }
    } else {
      const corner = drag.value.cropCorner || 'se'
      const right = drag.value.origX + drag.value.origW
      const bottom = drag.value.origY + drag.value.origH
      let left = drag.value.origX
      let top = drag.value.origY
      let rightEdge = right
      let bottomEdge = bottom

      if (corner.includes('e')) rightEdge = clamp(right + dLeft, left + MIN_CROP, 1)
      if (corner.includes('w')) left = clamp(drag.value.origX + dLeft, 0, right - MIN_CROP)
      if (corner.includes('s')) bottomEdge = clamp(bottom + dTop, top + MIN_CROP, 1)
      if (corner.includes('n')) top = clamp(drag.value.origY + dTop, 0, bottom - MIN_CROP)

      draftCrop.value = {
        left,
        top,
        width: rightEdge - left,
        height: bottomEdge - top
      }
    }
    return
  }

  if (drag.value.mode === 'move') {
    const maxX = pageWidthIn.value - drag.value.origW
    const maxY = pageHeightIn.value - drag.value.origH
    const nextX = clamp(drag.value.origX + dx, 0, Math.max(0, maxX))
    const nextY = clamp(drag.value.origY + dy, 0, Math.max(0, maxY))
    if (drag.value.kind === 'image' && drag.value.imageId) {
      const image = findImage(page, drag.value.imageId)
      if (image) {
        image.x = nextX
        image.y = nextY
      }
    } else if (drag.value.kind === 'text' && drag.value.textBoxId) {
      const box = page.textBoxes.find(b => b.id === drag.value!.textBoxId)
      if (box) {
        box.x = nextX
        box.y = nextY
      }
    }
  } else if (drag.value.mode === 'resize') {
    if (drag.value.kind === 'image' && drag.value.imageId) {
      const image = findImage(page, drag.value.imageId)
      if (!image) return
      const aspect = drag.value.origW / drag.value.origH
      let nextW = clamp(drag.value.origW + dx, MIN_ELEMENT_IN, pageWidthIn.value - drag.value.origX)
      let nextH = nextW / aspect
      if (drag.value.origY + nextH > pageHeightIn.value) {
        nextH = pageHeightIn.value - drag.value.origY
        nextW = nextH * aspect
      }
      if (nextW < MIN_ELEMENT_IN || nextH < MIN_ELEMENT_IN) return
      image.width = nextW
      image.height = nextH
    } else if (drag.value.kind === 'text' && drag.value.textBoxId) {
      const nextW = clamp(drag.value.origW + dx, MIN_ELEMENT_IN, pageWidthIn.value - drag.value.origX)
      const nextH = clamp(drag.value.origH + dy, MIN_ELEMENT_IN, pageHeightIn.value - drag.value.origY)
      const box = page.textBoxes.find(b => b.id === drag.value!.textBoxId)
      if (box) {
        box.width = nextW
        box.height = nextH
      }
    }
  }
  markDirty()
}

function onPointerUp() {
  drag.value = null
}

function styleForRect(x: number, y: number, width: number, height: number) {
  return {
    left: `${x * scale.value}px`,
    top: `${y * scale.value}px`,
    width: `${width * scale.value}px`,
    height: `${height * scale.value}px`
  }
}

function fontSizeCssPx(fontSizePt: number) {
  return (fontSizePt / 72) * scale.value
}

function cropOverlayStyle(crop: ManuscriptImageCrop) {
  const c = normalizeCrop(crop)
  return {
    left: `${c.left * 100}%`,
    top: `${c.top * 100}%`,
    width: `${c.width * 100}%`,
    height: `${c.height * 100}%`
  }
}

async function saveManuscript() {
  if (!manuscript.value) return
  saving.value = true
  try {
    await api(`/api/projects/${route.params.id}/manuscript`, {
      method: 'PUT',
      body: { manuscript: manuscript.value }
    })
    dirty.value = false
    toast.add({ title: 'Manuscript saved', color: 'success' })
    await refresh()
  } finally {
    saving.value = false
  }
}

async function generatePdf() {
  if (!manuscript.value) return
  generatingPdf.value = true
  try {
    if (dirty.value) {
      await api(`/api/projects/${route.params.id}/manuscript`, {
        method: 'PUT',
        body: { manuscript: manuscript.value }
      })
      dirty.value = false
    }
    const result = await api<{ pdfUrl: string }>(`/api/projects/${route.params.id}/generate-pdf`, {
      method: 'POST'
    })
    toast.add({ title: 'PDF generated', color: 'success' })
    if (result.pdfUrl) {
      window.open(result.pdfUrl, '_blank')
    }
  } finally {
    generatingPdf.value = false
  }
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div>
    <div
      v-if="pending && !manuscript"
      class="text-muted"
    >
      Loading manuscript…
    </div>
    <div
      v-else-if="error || !manuscript"
      class="text-muted"
    >
      Could not load manuscript.
    </div>
    <div
      v-else
      class="flex flex-col gap-4"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <AppPageHeader
            title="Manuscript editor"
            description="Arrange pages for print (8.155 × 10.25 in). Drag and resize images and text boxes."
          />
          <p
            v-if="dirty"
            class="text-sm text-warning -mt-4 mb-2"
          >
            Unsaved changes
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            :to="`/projects/${route.params.id}`"
            variant="outline"
            color="neutral"
            icon="i-lucide-arrow-left"
          >
            Back
          </UButton>
          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-undo-2"
            :disabled="!canUndo"
            @click="undo"
          >
            Undo
          </UButton>
          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-rotate-ccw"
            :disabled="!hasOriginal"
            @click="resetConfirmOpen = true"
          >
            Reset
          </UButton>
          <UButton
            variant="outline"
            color="neutral"
            :loading="saving"
            @click="saveManuscript"
          >
            Save
          </UButton>
          <UButton
            icon="i-lucide-file-text"
            :loading="generatingPdf"
            @click="generatePdf"
          >
            Generate PDF
          </UButton>
        </div>
      </div>

      <div class="flex flex-col xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] gap-6 xl:items-stretch xl:h-[calc(100dvh-9rem)] xl:min-h-0 xl:overflow-hidden">
        <div class="flex-1 min-w-0 space-y-2 order-2 xl:order-1 xl:overflow-y-auto xl:min-h-0 xl:pr-2">
          <template
            v-for="(page, index) in manuscript.pages"
            :key="page.id"
          >
            <div
              v-if="index > 0"
              class="flex justify-center py-1"
            >
              <UButton
                icon="i-lucide-plus"
                size="xs"
                color="neutral"
                variant="soft"
                aria-label="Insert blank page"
                @click="insertBlankAt(index)"
              />
            </div>

            <div class="flex flex-col sm:flex-row gap-3 items-start">
              <div class="flex sm:flex-col gap-1 shrink-0 pt-1">
                <span class="text-xs text-muted font-medium px-1">
                  Page {{ index + 1 }}
                </span>
                <UButton
                  icon="i-lucide-arrow-up"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="index === 0"
                  aria-label="Move page up"
                  @click="movePage(page.id, -1)"
                />
                <UButton
                  icon="i-lucide-arrow-down"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="index === manuscript.pages.length - 1"
                  aria-label="Move page down"
                  @click="movePage(page.id, 1)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="ghost"
                  aria-label="Delete page"
                  @click="deletePage(page.id)"
                />
                <UButton
                  icon="i-lucide-image-plus"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Add image"
                  @click="openAddImage(page.id)"
                />
                <UButton
                  icon="i-lucide-type"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  aria-label="Add text box"
                  @click="addTextBox(page.id)"
                />
              </div>

              <div
                class="relative bg-white shadow-md border border-default overflow-hidden select-none"
                :style="{
                  width: `${PAGE_DISPLAY_WIDTH_PX}px`,
                  height: `${pageDisplayHeight}px`
                }"
                @click.self="clearSelection"
              >
                <div
                  v-for="image in pageImagesList(page)"
                  :key="image.id"
                  class="absolute border-2 overflow-hidden"
                  :class="[
                    isCropping(page.id, image.id) ? 'cursor-crosshair z-20' : 'cursor-move z-10',
                    selection?.pageId === page.id && selection.kind === 'image' && selection.imageId === image.id
                      ? 'border-primary'
                      : 'border-transparent hover:border-primary/40'
                  ]"
                  :style="styleForRect(image.x, image.y, image.width, image.height)"
                  @pointerdown.stop="isCropping(page.id, image.id) ? undefined : startDrag($event, 'move', page.id, 'image', { imageId: image.id })"
                  @click.stop="selectImage(page.id, image.id)"
                >
                  <template v-if="isCropping(page.id, image.id) && draftCrop">
                    <img
                      :src="imageDisplayUrl(image)"
                      :alt="image.filename || image.mediaId || 'Image'"
                      class="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-40"
                      draggable="false"
                      @load="rememberNaturalSize(image, $event)"
                    >
                    <div
                      class="absolute border-2 border-primary bg-transparent cursor-move"
                      :style="cropOverlayStyle(draftCrop)"
                      @pointerdown.stop="startDrag($event, 'crop-move', page.id, 'image', { imageId: image.id })"
                    >
                      <div class="absolute inset-0 bg-primary/10 pointer-events-none" />
                      <div
                        class="absolute -left-1.5 -top-1.5 w-3.5 h-3.5 bg-primary border border-white rounded-sm cursor-nw-resize"
                        @pointerdown.stop="startDrag($event, 'crop-resize', page.id, 'image', { imageId: image.id, cropCorner: 'nw' })"
                      />
                      <div
                        class="absolute -right-1.5 -top-1.5 w-3.5 h-3.5 bg-primary border border-white rounded-sm cursor-ne-resize"
                        @pointerdown.stop="startDrag($event, 'crop-resize', page.id, 'image', { imageId: image.id, cropCorner: 'ne' })"
                      />
                      <div
                        class="absolute -left-1.5 -bottom-1.5 w-3.5 h-3.5 bg-primary border border-white rounded-sm cursor-sw-resize"
                        @pointerdown.stop="startDrag($event, 'crop-resize', page.id, 'image', { imageId: image.id, cropCorner: 'sw' })"
                      />
                      <div
                        class="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-primary border border-white rounded-sm cursor-se-resize"
                        @pointerdown.stop="startDrag($event, 'crop-resize', page.id, 'image', { imageId: image.id, cropCorner: 'se' })"
                      />
                    </div>
                  </template>
                  <template v-else>
                    <div class="w-full h-full overflow-hidden">
                      <img
                        :src="imageDisplayUrl(image)"
                        :alt="image.filename || image.mediaId || 'Image'"
                        class="pointer-events-none block"
                        :style="croppedImageStyle(image.crop)"
                        draggable="false"
                        @load="rememberNaturalSize(image, $event)"
                      >
                    </div>
                    <div
                      v-if="selection?.pageId === page.id && selection.kind === 'image' && selection.imageId === image.id"
                      class="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-primary border border-white rounded-sm cursor-se-resize"
                      @pointerdown.stop="startDrag($event, 'resize', page.id, 'image', { imageId: image.id })"
                    />
                  </template>
                </div>

                <div
                  v-for="box in page.textBoxes"
                  :key="box.id"
                  class="absolute border-2 cursor-move overflow-hidden bg-white/80 z-30"
                  :class="selection?.pageId === page.id && selection.kind === 'text' && selection.textBoxId === box.id
                    ? 'border-primary'
                    : 'border-dashed border-muted/60 hover:border-primary/50'"
                  :style="styleForRect(box.x, box.y, box.width, box.height)"
                  @pointerdown.stop="startDrag($event, 'move', page.id, 'text', { textBoxId: box.id })"
                  @click.stop="selectText(page.id, box.id)"
                >
                  <div
                    class="w-full h-full p-1 whitespace-pre-wrap wrap-break-word pointer-events-none overflow-hidden"
                    :style="{
                      fontFamily: `'${box.fontFamily}', serif`,
                      fontSize: `${fontSizeCssPx(box.fontSizePt)}px`,
                      textAlign: box.align,
                      color: box.color || DEFAULT_TEXT_COLOR,
                      lineHeight: 1.35
                    }"
                  >
                    {{ box.text || 'Select to edit text' }}
                  </div>
                  <div
                    v-if="selection?.pageId === page.id && selection.kind === 'text' && selection.textBoxId === box.id"
                    class="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-primary border border-white rounded-sm cursor-se-resize"
                    @pointerdown.stop="startDrag($event, 'resize', page.id, 'text', { textBoxId: box.id })"
                  />
                </div>
              </div>
            </div>

          </template>

          <div class="flex justify-center py-2">
            <UButton
              icon="i-lucide-plus"
              size="sm"
              color="neutral"
              variant="soft"
              @click="insertBlankAt(manuscript.pages.length)"
            >
              Add blank page
            </UButton>
          </div>
        </div>

        <aside class="w-full xl:w-auto order-1 xl:order-2 shrink-0 sticky top-0 z-50 -mx-6 px-6 py-3 mb-2 xl:mx-0 xl:px-0 xl:py-0 xl:mb-0 xl:static xl:self-stretch xl:overflow-y-auto xl:min-h-0 bg-default/95 backdrop-blur border-b border-default xl:border-0 xl:bg-transparent xl:backdrop-blur-none">
          <UCard class="w-full">
            <template #header>
              <p class="font-medium">
                Inspector
              </p>
            </template>

            <div
              v-if="!selection"
              class="text-sm text-muted"
            >
              Select an image or text box on a page.
            </div>

            <div
              v-else-if="selection.kind === 'image' && selectedImage"
              class="space-y-3 text-sm"
            >
              <p class="font-medium">
                Image
              </p>
              <p class="text-muted break-all">
                {{ selectedImage.source === 'global' ? `Site media · ${selectedImage.mediaId}` : selectedImage.filename }}
              </p>
              <p class="text-xs text-muted">
                Images always sit under text. Resize keeps aspect ratio.
              </p>

              <div class="grid grid-cols-2 gap-2">
                <UButton
                  size="sm"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-align-horizontal-space-around"
                  @click="alignSelected('horizontal')"
                >
                  Align H
                </UButton>
                <UButton
                  size="sm"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-align-vertical-space-around"
                  @click="alignSelected('vertical')"
                >
                  Align V
                </UButton>
              </div>

              <div
                v-if="cropMode?.imageId === selection.imageId"
                class="flex flex-col gap-2"
              >
                <p class="text-xs text-muted">
                  Drag the crop box or use any corner handle, then apply.
                </p>
                <UButton
                  size="sm"
                  block
                  @click="applyCrop"
                >
                  Apply crop
                </UButton>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  block
                  @click="cancelCrop"
                >
                  Cancel
                </UButton>
              </div>
              <div
                v-else
                class="flex flex-col gap-2"
              >
                <UButton
                  size="sm"
                  variant="soft"
                  color="neutral"
                  block
                  icon="i-lucide-crop"
                  @click="beginCrop"
                >
                  Crop
                </UButton>
                <UButton
                  size="sm"
                  variant="ghost"
                  color="neutral"
                  block
                  @click="resetCrop"
                >
                  Reset crop
                </UButton>
              </div>
              <UButton
                color="error"
                variant="soft"
                size="sm"
                block
                @click="deleteSelectedElement"
              >
                Remove image
              </UButton>
            </div>

            <div
              v-else-if="selectedTextBox"
              class="space-y-4"
            >
              <p class="font-medium text-sm">
                Text box
              </p>

              <UFormField label="Text">
                <UTextarea
                  v-model="selectedTextBox.text"
                  :rows="6"
                  autoresize
                  class="w-full"
                  placeholder="Enter text…"
                  @focus="pushHistory"
                  @update:model-value="markDirty"
                />
              </UFormField>

              <div class="grid grid-cols-2 gap-2">
                <UButton
                  size="sm"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-align-horizontal-space-around"
                  @click="alignSelected('horizontal')"
                >
                  Align H
                </UButton>
                <UButton
                  size="sm"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-align-vertical-space-around"
                  @click="alignSelected('vertical')"
                >
                  Align V
                </UButton>
              </div>

              <UFormField label="Font family">
                <UInput
                  v-model="selectedTextBox.fontFamily"
                  placeholder="Literata"
                  class="w-full"
                  @update:model-value="markDirty"
                />
              </UFormField>

              <UFormField label="Font size (pt)">
                <UInput
                  v-model.number="selectedTextBox.fontSizePt"
                  type="number"
                  min="8"
                  max="96"
                  class="w-full"
                  @update:model-value="markDirty"
                />
              </UFormField>

              <UFormField label="Align">
                <USelect
                  v-model="selectedTextBox.align"
                  :items="[
                    { label: 'Left', value: 'left' },
                    { label: 'Center', value: 'center' },
                    { label: 'Right', value: 'right' }
                  ]"
                  class="w-full"
                  @update:model-value="markDirty"
                />
              </UFormField>

              <UFormField label="Text color">
                <div class="flex items-center gap-2">
                  <input
                    v-model="selectedTextBox.color"
                    type="color"
                    class="h-9 w-12 cursor-pointer rounded border border-default bg-transparent p-0.5"
                    @input="markDirty"
                  >
                  <UInput
                    v-model="selectedTextBox.color"
                    placeholder="#000000"
                    class="flex-1"
                    @update:model-value="markDirty"
                  />
                </div>
              </UFormField>

              <UFormField label="Move to page">
                <div class="flex gap-2">
                  <USelect
                    v-model="moveTargetPage"
                    :items="pageOptions"
                    placeholder="Page…"
                    class="flex-1"
                  />
                  <UButton
                    :disabled="!moveTargetPage"
                    @click="moveTextToPage"
                  >
                    Move
                  </UButton>
                </div>
              </UFormField>

              <UButton
                color="error"
                variant="soft"
                size="sm"
                block
                @click="deleteSelectedElement"
              >
                Delete text box
              </UButton>
            </div>
          </UCard>
        </aside>
      </div>

      <UModal
        v-model:open="mediaPickerOpen"
        title="Add image"
        :ui="{ content: 'sm:max-w-2xl' }"
      >
        <template #body>
          <div class="flex gap-2 mb-4">
            <UButton
              size="sm"
              :variant="mediaPickerTab === 'project' ? 'solid' : 'soft'"
              color="neutral"
              @click="mediaPickerTab = 'project'"
            >
              This project
            </UButton>
            <UButton
              size="sm"
              :variant="mediaPickerTab === 'global' ? 'solid' : 'soft'"
              color="neutral"
              @click="mediaPickerTab = 'global'"
            >
              Site media
            </UButton>
          </div>

          <div
            v-if="addingImage"
            class="text-sm text-muted py-8 text-center"
          >
            Adding image…
          </div>

          <div
            v-else-if="mediaPickerTab === 'project'"
            class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto"
          >
            <button
              v-for="item in projectPickerItems"
              :key="item.key"
              type="button"
              class="border border-default rounded-md overflow-hidden hover:border-primary text-left"
              @click="pickProjectImage(item.filename)"
            >
              <div class="aspect-square bg-elevated flex items-center justify-center">
                <img
                  :src="item.thumbUrl"
                  :alt="item.label"
                  class="w-full h-full object-contain"
                >
              </div>
              <p class="text-[11px] p-1.5 truncate">
                {{ item.label }}
              </p>
            </button>
            <p
              v-if="!projectPickerItems.length"
              class="col-span-full text-sm text-muted py-6 text-center"
            >
              No processed project images.
            </p>
          </div>

          <div
            v-else
            class="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto"
          >
            <button
              v-for="item in globalPickerItems"
              :key="item.key"
              type="button"
              class="border border-default rounded-md overflow-hidden hover:border-primary text-left"
              @click="pickGlobalImage(item)"
            >
              <div class="aspect-square bg-elevated flex items-center justify-center">
                <img
                  :src="item.thumbUrl"
                  :alt="item.label"
                  class="w-full h-full object-contain"
                >
              </div>
              <p class="text-[11px] p-1.5 truncate">
                {{ item.label }}
              </p>
            </button>
            <p
              v-if="!globalPickerItems.length"
              class="col-span-full text-sm text-muted py-6 text-center"
            >
              No site media yet. Upload images from the Media page.
            </p>
          </div>
        </template>
      </UModal>

      <UModal
        v-model:open="resetConfirmOpen"
        title="Reset manuscript?"
        description="Are you sure? This discards all layout edits and restores the first version of this manuscript."
        :ui="{ footer: 'justify-end gap-2' }"
      >
        <template #footer>
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            :disabled="resetting"
            @click="resetConfirmOpen = false"
          />
          <UButton
            label="Reset manuscript"
            color="error"
            :loading="resetting"
            @click="resetManuscript"
          />
        </template>
      </UModal>
    </div>
  </div>
</template>
