<script setup lang="ts">
defineProps<{
  message: string
  cancellable?: boolean
}>()

const emit = defineEmits<{
  cancel: []
}>()
</script>

<template>
  <div class="fixed inset-0 z-50 bg-default/80 backdrop-blur-sm flex items-center justify-center">
    <UCard class="w-full max-w-md">
      <div class="flex flex-col items-center gap-4 py-4">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-10 animate-spin text-primary"
        />
        <p class="text-center font-medium">
          {{ message }}
        </p>
        <UButton
          v-if="cancellable"
          variant="outline"
          color="neutral"
          @click="emit('cancel')"
        >
          Cancel
        </UButton>
      </div>
    </UCard>
  </div>
</template>
