<script setup lang="ts">
const { api } = useApi()
const toast = useToast()

const { data: status, refresh } = useFetch('/api/update/status', {
  lazy: true,
  server: false
})

const pulling = ref(false)

const show = computed(() => status.value?.outdated === true)

const title = computed(() => {
  const behind = status.value?.behind ?? 0
  if (behind === 1) return '1 update is available on master'
  return `${behind} updates are available on master`
})

async function pullAndRefresh() {
  pulling.value = true
  try {
    await api('/api/update/pull', { method: 'POST' })
    toast.add({
      title: 'Updated',
      description: 'Reloading with the latest changes…',
      color: 'success'
    })
    window.location.reload()
  } catch {
    // useApi already toasts the error
  } finally {
    pulling.value = false
  }
}

let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  pollTimer = setInterval(() => {
    refresh()
  }, 10 * 60 * 1000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <UAlert
    v-if="show"
    color="info"
    variant="subtle"
    icon="i-lucide-download"
    :title="title"
    description="Pull the latest changes from master and refresh this page."
    class="mb-4"
  >
    <template #actions>
      <UButton
        color="primary"
        size="sm"
        :loading="pulling"
        :disabled="pulling"
        @click="pullAndRefresh"
      >
        {{ pulling ? 'Updating…' : 'Pull latest & refresh' }}
      </UButton>
    </template>
  </UAlert>
</template>
