<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface MediaItem {
  id: string
  filename: string
  originalName: string
  mime: string
  width: number
  height: number
  createdAt: string
  url: string
  thumbnailUrl: string
}

const toast = useToast()
const { api } = useApi()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const deletingId = ref<string | null>(null)

const { data, refresh, pending } = await useFetch<{ items: MediaItem[] }>('/api/media')

const items = computed(() => data.value?.items || [])

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    await api('/api/media', { method: 'POST', body })
    await refresh()
    toast.add({ title: 'Image uploaded', color: 'success' })
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function removeItem(item: MediaItem) {
  const confirmed = window.confirm(`Delete “${item.originalName}”? This cannot be undone.`)
  if (!confirmed) return
  deletingId.value = item.id
  try {
    await api(`/api/media/${item.id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Deleted', color: 'success' })
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Media"
      description="Site-wide images you can use in any project manuscript."
    />

    <div class="flex flex-wrap items-center gap-3 mb-6">
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
        @change="onFileChange"
      >
      <UButton
        icon="i-lucide-upload"
        :loading="uploading"
        @click="fileInput?.click()"
      >
        Upload image
      </UButton>
      <p class="text-sm text-muted">
        PNG, JPG, WEBP, or GIF
      </p>
    </div>

    <div
      v-if="pending && !items.length"
      class="text-muted"
    >
      Loading media…
    </div>
    <div
      v-else-if="!items.length"
      class="text-muted border border-dashed border-default rounded-lg p-10 text-center"
    >
      No site media yet. Upload an image to get started.
    </div>
    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="group border border-default rounded-lg overflow-hidden bg-elevated"
      >
        <div class="aspect-square bg-default flex items-center justify-center overflow-hidden">
          <img
            :src="item.thumbnailUrl"
            :alt="item.originalName"
            class="w-full h-full object-contain"
          >
        </div>
        <div class="p-2 space-y-2">
          <p
            class="text-xs truncate"
            :title="item.originalName"
          >
            {{ item.originalName }}
          </p>
          <p class="text-[11px] text-muted">
            {{ item.width }}×{{ item.height }}
          </p>
          <UButton
            size="xs"
            color="error"
            variant="soft"
            block
            :loading="deletingId === item.id"
            @click="removeItem(item)"
          >
            Delete
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
