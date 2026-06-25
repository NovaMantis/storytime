<script setup lang="ts">
import Sortable from 'sortablejs'

definePageMeta({ layout: 'admin' })

interface ProjectDetail {
  id: string
  senderEmail: string
  status: string
  notes: string
  imageOrder: string[]
  thumbnails: {
    filename: string
    thumbnailUrl: string
    processedUrl: string
    originalUrl: string | null
    originalFilename: string | null
    extractedText: string | null
  }[]
  hasPdf: boolean
  pdfUrl: string | null
  updatedAt: string
  pendingReview?: boolean
}

const route = useRoute()
const toast = useToast()
const { api } = useApi()

const statusOptions = [
  { label: 'In review', value: 'In review' },
  { label: 'Ready', value: 'Ready' }
]

const { data: project, refresh } = await useFetch<ProjectDetail>(
  () => `/api/projects/${route.params.id}`
)

if (project.value?.pendingReview) {
  await navigateTo(`/projects/${route.params.id}/review`, { replace: true })
}

watch(project, (value) => {
  if (value?.pendingReview) {
    navigateTo(`/projects/${route.params.id}/review`, { replace: true })
  }
})

const notes = ref('')
const status = ref('In review')
const imageOrder = ref<string[]>([])
const showOriginals = ref(false)
const saving = ref(false)
const generatingPdf = ref(false)
const listRef = ref<HTMLElement | null>(null)

watch(project, (value) => {
  if (!value || value.pendingReview) return
  notes.value = value.notes
  status.value = value.status
  imageOrder.value = [...value.imageOrder]
}, { immediate: true })

onMounted(() => {
  if (!listRef.value) return
  Sortable.create(listRef.value, {
    animation: 150,
    handle: '.drag-handle',
    draggable: '.image-item',
    onEnd: () => {
      if (!listRef.value) return
      const filenames = [...listRef.value.querySelectorAll('.image-item')]
        .map(el => (el as HTMLElement).dataset.filename)
        .filter(Boolean) as string[]
      imageOrder.value = filenames
      saveProject({ imageOrder: filenames })
    }
  })
})

async function saveProject(patch?: { status?: string, notes?: string, imageOrder?: string[] }) {
  if (!project.value) return
  saving.value = true
  try {
    await api(`/api/projects/${project.value.id}`, {
      method: 'PATCH',
      body: {
        status: patch?.status ?? status.value,
        notes: patch?.notes ?? notes.value,
        imageOrder: patch?.imageOrder ?? imageOrder.value
      }
    })
    await refresh()
    toast.add({ title: 'Saved', color: 'success' })
  } finally {
    saving.value = false
  }
}

async function generatePdf() {
  if (!project.value) return
  generatingPdf.value = true
  try {
    const result = await api<{ pdfUrl: string }>(`/api/projects/${project.value.id}/generate-pdf`, {
      method: 'POST'
    })
    await refresh()
    toast.add({ title: 'PDF generated', color: 'success' })
    if (result.pdfUrl) {
      window.open(result.pdfUrl, '_blank')
    }
  } finally {
    generatingPdf.value = false
  }
}

const orderedImages = computed(() => {
  if (!project.value) return []
  const map = new Map(project.value.thumbnails.map(t => [t.filename, t]))
  return imageOrder.value
    .map(filename => map.get(filename))
    .filter(Boolean) as ProjectDetail['thumbnails']
})

async function copyExtractedText(text: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: 'Copied to clipboard', color: 'success' })
}
</script>

<template>
  <div
    v-if="!project || project.pendingReview"
    class="text-muted"
  >
    {{ project?.pendingReview ? 'Opening image review…' : 'Loading project…' }}
  </div>
  <div v-else>
    <AppPageHeader
      :title="project.senderEmail"
      description="Review processed images, add notes, and generate a test PDF."
    />

    <div class="flex flex-wrap gap-3 mb-6">
      <USelect
        v-model="status"
        :items="statusOptions"
        class="w-40"
        @update:model-value="saveProject({ status: $event as string })"
      />
      <UButton
        variant="outline"
        color="neutral"
        :loading="saving"
        @click="saveProject()"
      >
        Save notes
      </UButton>
      <UButton
        icon="i-lucide-file-text"
        :loading="generatingPdf"
        @click="generatePdf"
      >
        Generate PDF
      </UButton>
      <UButton
        v-if="project.hasPdf && project.pdfUrl"
        :to="project.pdfUrl"
        target="_blank"
        variant="soft"
        color="neutral"
        icon="i-lucide-external-link"
      >
        View PDF
      </UButton>
      <AppDeleteProjectButton
        :project-id="project.id"
        :project-label="project.senderEmail"
        redirect
      />
    </div>

    <UCard class="mb-6">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-medium">
              Images
            </p>
            <p class="text-sm text-muted">
              Drag rows to reorder. Default order is by filename.
            </p>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
            <USwitch
              v-model="showOriginals"
              aria-label="Show original images"
            />
            Show originals
          </label>
        </div>
      </template>
      <div
        ref="listRef"
        class="space-y-4"
      >
        <UCard
          v-for="image in orderedImages"
          :key="image.filename"
          class="image-item"
          :data-filename="image.filename"
        >
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-grip-vertical"
                class="drag-handle size-5 text-muted cursor-grab active:cursor-grabbing shrink-0"
              />
              <span class="text-xs text-muted truncate">
                {{ image.filename }}
              </span>
            </div>

            <div
              class="grid gap-4"
              :class="showOriginals && image.originalUrl ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'"
            >
              <div>
                <p class="text-xs text-muted mb-1">
                  Processed
                </p>
                <img
                  :src="image.processedUrl"
                  :alt="image.filename"
                  class="w-full rounded border border-default bg-white"
                >
              </div>
              <div v-if="showOriginals && image.originalUrl">
                <p class="text-xs text-muted mb-1">
                  Original
                </p>
                <img
                  :src="image.originalUrl"
                  :alt="image.originalFilename || 'Original'"
                  class="w-full rounded border border-default bg-white"
                >
              </div>
            </div>

            <div
              v-if="image.extractedText"
              class="space-y-2"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs text-muted">
                  Extracted text
                </p>
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-copy"
                  @click="copyExtractedText(image.extractedText!)"
                >
                  Copy
                </UButton>
              </div>
              <pre class="text-sm whitespace-pre-wrap font-sans bg-elevated rounded p-3 border border-default">{{ image.extractedText }}</pre>
            </div>
          </div>
        </UCard>
        <p
          v-if="orderedImages.length === 0"
          class="text-muted"
        >
          No processed images yet.
        </p>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <p class="font-medium">
          Notes
        </p>
      </template>
      <UTextarea
        v-model="notes"
        :rows="8"
        placeholder="Add project notes (saved as markdown in project.md)…"
        class="w-full"
      />
    </UCard>
  </div>
</template>
