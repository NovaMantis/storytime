<script setup lang="ts">
defineProps<{
  message: string
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
      </div>
    </UCard>
  </div>
</template>
