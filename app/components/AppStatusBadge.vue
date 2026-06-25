<script setup lang="ts">
const props = defineProps<{
  status: string
}>()

const color = computed(() => {
  switch (props.status) {
    case 'processed':
    case 'Ready':
      return 'success' as const
    case 'error':
      return 'error' as const
    case 'skipped':
      return 'neutral' as const
    case 'pending':
    case 'awaiting_review':
    case 'In review':
      return 'warning' as const
    default:
      return 'neutral' as const
  }
})

const label = computed(() => {
  switch (props.status) {
    case 'pending': return 'Unprocessed'
    case 'awaiting_review': return 'Awaiting review'
    case 'processed': return 'Processed'
    case 'skipped': return 'No images'
    case 'error': return 'Error'
    default: return props.status
  }
})
</script>

<template>
  <UBadge
    :color="color"
    variant="subtle"
  >
    {{ label }}
  </UBadge>
</template>
