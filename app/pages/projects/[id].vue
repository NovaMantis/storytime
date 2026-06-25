<script setup lang="ts">
import Sortable from 'sortablejs'

definePageMeta({ layout: 'admin' })

interface ProjectDetail {
  id: string
  senderEmail: string
  status: string
  notes: string
  imageOrder: string[]
  thumbnails: { filename: string, thumbnailUrl: string }[]
  hasPdf: boolean
  pdfUrl: string | null
  updatedAt: string
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

const notes = ref('')
const status = ref('In review')
const imageOrder = ref<string[]>([])
const saving = ref(false)
const generatingPdf = ref(false)
const gridRef = ref<HTMLElement | null>(null)

watch(project, (value) => {
  if (!value) return
  notes.value = value.notes
  status.value = value.status
  imageOrder.value = [...value.imageOrder]
}, { immediate: true })

onMounted(() => {
  if (!gridRef.value) return
  Sortable.create(gridRef.value, {
    animation: 150,
    draggable: '.thumb-item',
    onEnd: () => {
      if (!gridRef.value) return
      const filenames = [...gridRef.value.querySelectorAll('.thumb-item')]
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

const orderedThumbnails = computed(() => {
  if (!project.value) return []
  const map = new Map(project.value.thumbnails.map(t => [t.filename, t]))
  return imageOrder.value
    .map(filename => map.get(filename))
    .filter(Boolean) as ProjectDetail['thumbnails']
})
</script>

<template>
  <div v-if="project">
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
    </div>

    <UCard class="mb-6">
      <template #header>
        <p class="font-medium">
          Images
        </p>
        <p class="text-sm text-muted">
          Drag thumbnails to reorder. Default order is by filename.
        </p>
      </template>
      <div
        ref="gridRef"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
      >
        <div
          v-for="thumb in orderedThumbnails"
          :key="thumb.filename"
          class="thumb-item cursor-move"
          :data-filename="thumb.filename"
        >
          <div class="aspect-square rounded-lg overflow-hidden border border-default bg-elevated">
            <img
              :src="thumb.thumbnailUrl"
              :alt="thumb.filename"
              class="w-full h-full object-cover"
            >
          </div>
          <p class="text-xs text-muted mt-1 truncate">
            {{ thumb.filename }}
          </p>
        </div>
        <p
          v-if="orderedThumbnails.length === 0"
          class="text-muted col-span-full"
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
