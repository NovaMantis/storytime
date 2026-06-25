<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<template>
  <UAlert
    color="error"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    :title="message"
    class="mb-4"
  />
</template>
