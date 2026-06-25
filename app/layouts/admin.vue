<script setup lang="ts">
const route = useRoute()

const nav = [
  { label: 'Inbox', to: '/inbox', icon: 'i-lucide-inbox' },
  { label: 'Projects', to: '/projects', icon: 'i-lucide-folder-open' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' }
]

const { data: health } = await useFetch('/api/health')

const { jokeActive, jokeMessage } = useJokeStatus()

const syncLabel = computed(() => {
  if (!health.value?.imapConfigured) return 'IMAP not configured'
  if (health.value?.lastSyncStatus === 'error') return 'Sync failed'
  if (health.value?.lastSyncAt) {
    return `Last sync: ${new Date(health.value.lastSyncAt).toLocaleString()}`
  }
  return 'Waiting for first sync'
})

const headerStatus = computed(() =>
  jokeActive.value ? jokeMessage : syncLabel.value
)
</script>

<template>
  <div class="min-h-screen flex bg-default">
    <aside class="w-56 border-r border-default bg-elevated/50 p-4 flex flex-col gap-6">
      <div>
        <p class="text-lg font-semibold">
          Storytime
        </p>
        <p class="text-xs text-muted mt-1">
          Admin Panel
        </p>
      </div>

      <nav class="flex flex-col gap-1">
        <UButton
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :variant="route.path.startsWith(item.to) ? 'soft' : 'ghost'"
          color="neutral"
          class="justify-start"
          block
        >
          {{ item.label }}
        </UButton>
      </nav>
    </aside>

    <div class="flex-1 flex flex-col min-w-0">
      <header class="border-b border-default px-6 py-3 flex items-center justify-between gap-4">
        <div
          class="text-sm text-muted transition-opacity duration-300"
          :class="{ 'italic text-error': jokeActive }"
        >
          {{ headerStatus }}
        </div>
        <UColorModeButton />
      </header>

      <main class="flex-1 p-6 overflow-auto">
        <AppSyncBanner
          v-if="health?.lastSyncStatus === 'error'"
          :message="health.lastSyncError || 'Inbox sync failed. Check your Zoho credentials in .env.'"
        />
        <slot />
      </main>
    </div>
  </div>
</template>
