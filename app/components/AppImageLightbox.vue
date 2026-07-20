<script setup lang="ts">
export interface LightboxImage {
  src: string
  alt?: string
}

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(defineProps<{
  images: LightboxImage[]
  startIndex?: number
}>(), {
  startIndex: 0
})

const carouselKey = ref(0)
const activeIndex = ref(0)

watch(open, (isOpen) => {
  if (!isOpen) return
  const max = Math.max(0, props.images.length - 1)
  activeIndex.value = Math.min(Math.max(0, props.startIndex), max)
  carouselKey.value += 1
})
</script>

<template>
  <UModal
    v-model:open="open"
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #content>
      <div class="relative p-4 sm:p-6">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          class="absolute top-3 right-3 z-10"
          aria-label="Close"
          @click="open = false"
        />

        <p
          v-if="images[activeIndex]?.alt"
          class="text-sm text-muted truncate mb-3 pr-10"
        >
          {{ images[activeIndex]?.alt }}
          <span v-if="images.length > 1">
            ({{ activeIndex + 1 }} / {{ images.length }})
          </span>
        </p>

        <UCarousel
          v-if="open && images.length > 0"
          :key="carouselKey"
          v-slot="{ item }"
          arrows
          dots
          :items="images"
          :options="{ startIndex: activeIndex }"
          class="w-full"
          :ui="{
            item: 'basis-full',
            container: 'ms-0'
          }"
          @select="activeIndex = $event"
        >
          <div class="flex items-center justify-center min-h-[50vh] bg-elevated/40 rounded-lg">
            <img
              :src="item.src"
              :alt="item.alt || 'Image'"
              class="max-h-[70vh] w-auto max-w-full object-contain rounded-lg"
            >
          </div>
        </UCarousel>

        <p
          v-else-if="open"
          class="text-center text-muted py-12"
        >
          No images to display.
        </p>
      </div>
    </template>
  </UModal>
</template>
