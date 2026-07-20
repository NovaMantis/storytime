<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface ReviewImage {
  filename: string
  preprocessedUrl: string
  originalUrl: string | null
  originalFilename: string | null
  preprocessError: string | null
}

interface ReviewData {
  projectId: string
  senderEmail: string
  jobId: string
  images: ReviewImage[]
}

const route = useRoute()
const toast = useToast()
const { api } = useApi()

const showOriginals = ref(false)
const selectedImageAi = ref<string[]>([])
const selectedTextAi = ref<string[]>([])
const finalizing = ref(false)
const finalizingMessage = ref('Finalizing images…')
let finalizeAbortController: AbortController | null = null

const { data: review, error } = await useFetch<ReviewData>(
  () => `/api/projects/${route.params.id}/review`
)

watch(review, (value) => {
  if (!value) return
  selectedImageAi.value = []
  selectedTextAi.value = []
}, { immediate: true })

const allImageAiSelected = computed(() =>
  review.value
  && review.value.images.length > 0
  && selectedImageAi.value.length === review.value.images.length
)

const allTextAiSelected = computed(() =>
  review.value
  && review.value.images.length > 0
  && selectedTextAi.value.length === review.value.images.length
)

function toggleAllImageAi(checked: boolean) {
  if (!review.value) return
  selectedImageAi.value = checked ? review.value.images.map(i => i.filename) : []
}

function toggleAllTextAi(checked: boolean) {
  if (!review.value) return
  selectedTextAi.value = checked ? review.value.images.map(i => i.filename) : []
}

function toggleImageAiRow(filename: string, checked: boolean) {
  selectedImageAi.value = checked
    ? [...selectedImageAi.value, filename]
    : selectedImageAi.value.filter(x => x !== filename)
}

function toggleTextAiRow(filename: string, checked: boolean) {
  selectedTextAi.value = checked
    ? [...selectedTextAi.value, filename]
    : selectedTextAi.value.filter(x => x !== filename)
}

function cancelFinalize() {
  finalizeAbortController?.abort()
}

function buildFinalizingMessage(): string {
  const parts: string[] = []
  if (selectedTextAi.value.length > 0) {
    parts.push(`Extracting text from ${selectedTextAi.value.length} image(s)`)
  }
  if (selectedImageAi.value.length > 0) {
    parts.push(`Enhancing ${selectedImageAi.value.length} image(s) with AI`)
  }
  if (parts.length === 0) {
    return 'Saving preprocessed images…'
  }
  return `${parts.join(' and ')}…`
}

function buildSuccessDescription(): string {
  const parts: string[] = []
  if (selectedImageAi.value.length > 0) {
    parts.push(`${selectedImageAi.value.length} image(s) enhanced with AI`)
  }
  if (selectedTextAi.value.length > 0) {
    parts.push(`text extracted from ${selectedTextAi.value.length} image(s)`)
  }
  if (parts.length === 0) {
    return 'All images saved from preprocessing.'
  }
  return parts.join('; ') + '.'
}

async function continueReview() {
  if (!review.value) return

  finalizeAbortController = new AbortController()
  finalizing.value = true
  finalizingMessage.value = buildFinalizingMessage()

  try {
    const result = await api<{ projectId: string, warnings?: string[] }>(
      `/api/projects/${review.value.projectId}/finalize`,
      {
        method: 'POST',
        body: {
          aiFilenames: selectedImageAi.value,
          textFilenames: selectedTextAi.value
        },
        signal: finalizeAbortController.signal
      }
    )

    if (result.warnings?.length) {
      toast.add({
        title: 'Completed with warnings',
        description: result.warnings.join('; '),
        color: 'warning'
      })
    } else {
      toast.add({
        title: 'Images finalized',
        description: buildSuccessDescription(),
        color: 'success'
      })
    }

    await navigateTo(`/projects/${result.projectId}`)
  } catch (err) {
    if (isAbortError(err)) {
      toast.add({
        title: 'Cancelled',
        description: 'Processing was cancelled.',
        color: 'neutral'
      })
    }
  } finally {
    finalizing.value = false
    finalizeAbortController = null
  }
}

const continueButtonLabel = computed(() => {
  const parts: string[] = []
  if (selectedImageAi.value.length > 0) {
    parts.push(`${selectedImageAi.value.length} image`)
  }
  if (selectedTextAi.value.length > 0) {
    parts.push(`${selectedTextAi.value.length} text`)
  }
  if (parts.length === 0) return 'Continue'
  return `Continue (${parts.join(', ')})`
})

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

const lightboxImages = computed(() =>
  (review.value?.images ?? []).map(image => ({
    src: image.preprocessedUrl,
    alt: image.filename
  }))
)

function openLightbox(index: number) {
  lightboxIndex.value = index
  lightboxOpen.value = true
}
</script>

<template>
  <div>
    <AppLoadingOverlay
      v-if="finalizing"
      :message="finalizingMessage"
      cancellable
      @cancel="cancelFinalize"
    />

    <AppPageHeader
      title="Review preprocessed images"
      :description="review ? `Choose image enhancement and/or text extraction for ${review.senderEmail}.` : 'Loading review…'"
    />

    <UAlert
      v-if="error"
      color="error"
      title="Review not available"
      description="This project has no images awaiting review."
      class="mb-4"
    />

    <template v-else-if="review">
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <label class="inline-flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
          <USwitch
            v-model="showOriginals"
            aria-label="Show original images"
          />
          Show originals
        </label>
        <UCheckbox
          :model-value="allImageAiSelected"
          label="Select all for image enhancement"
          @update:model-value="toggleAllImageAi(!!$event)"
        />
        <UCheckbox
          :model-value="allTextAiSelected"
          label="Select all for text extraction"
          @update:model-value="toggleAllTextAi(!!$event)"
        />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <UCard
          v-for="(image, index) in review.images"
          :key="image.filename"
        >
          <div class="space-y-3">
            <div
              class="grid gap-3"
              :class="showOriginals && image.originalUrl ? 'grid-cols-2' : 'grid-cols-1'"
            >
              <div>
                <p class="text-xs text-muted mb-1">
                  Preprocessed
                </p>
                <button
                  type="button"
                  class="block w-full text-left cursor-zoom-in"
                  :aria-label="`View ${image.filename}`"
                  @click="openLightbox(index)"
                >
                  <img
                    :src="image.preprocessedUrl"
                    :alt="image.filename"
                    class="w-full rounded border border-default bg-white"
                  >
                </button>
              </div>
              <div v-if="showOriginals && image.originalUrl">
                <p class="text-xs text-muted mb-1">
                  Original
                </p>
                <button
                  type="button"
                  class="block w-full text-left cursor-zoom-in"
                  :aria-label="`View original ${image.originalFilename || image.filename}`"
                  @click="openLightbox(index)"
                >
                  <img
                    :src="image.originalUrl"
                    :alt="image.originalFilename || 'Original'"
                    class="w-full rounded border border-default bg-white"
                  >
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <UCheckbox
                :model-value="selectedImageAi.includes(image.filename)"
                label="Enhance image with AI"
                @update:model-value="toggleImageAiRow(image.filename, !!$event)"
              />
              <UCheckbox
                :model-value="selectedTextAi.includes(image.filename)"
                label="Extract text with AI"
                @update:model-value="toggleTextAiRow(image.filename, !!$event)"
              />
            </div>

            <span class="text-xs text-muted truncate block">
              {{ image.filename }}
            </span>
          </div>
        </UCard>
      </div>

      <div
        v-if="review.images.length === 0"
        class="text-center text-muted py-12"
      >
        No preprocessed images found.
      </div>

      <div class="flex justify-end gap-3">
        <UButton
          size="lg"
          :loading="finalizing"
          @click="continueReview"
        >
          {{ continueButtonLabel }}
        </UButton>
      </div>

      <AppImageLightbox
        v-model:open="lightboxOpen"
        :images="lightboxImages"
        :start-index="lightboxIndex"
      />
    </template>
  </div>
</template>
