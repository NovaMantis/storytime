<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface InboxEmail {
  id: string
  sender: string
  subject: string
  received_at: string
  has_image_attachments: boolean
  attachment_count: number
  processed: boolean
  status: string
  status_message: string | null
}

const filter = ref('all')
const selected = ref<string[]>([])
const processing = ref(false)
const processingMessage = ref('Processing emails…')
const toast = useToast()
const { api } = useApi()

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Unprocessed', value: 'unprocessed' },
  { label: 'Processed', value: 'processed' },
  { label: 'Errors', value: 'errors' },
  { label: 'No images', value: 'no-images' }
]

const { data, refresh, status } = await useFetch('/api/inbox', {
  query: computed(() => ({ filter: filter.value, pageSize: 100 })),
  watch: [filter]
})

const emails = computed(() => data.value?.emails ?? [])

function extractSender(sender: string) {
  const match = sender.match(/<([^>]+)>/)
  return (match?.[1] || sender).trim().toLowerCase()
}

const selectedEmails = computed(() =>
  emails.value.filter(e => selected.value.includes(e.id))
)

const canProcess = computed(() =>
  selectedEmails.value.length > 0
  && selectedEmails.value.every(e => e.has_image_attachments && !e.processed)
)

function toggleAll(checked: boolean) {
  if (checked) {
    selected.value = emails.value
      .filter(e => e.has_image_attachments && !e.processed)
      .map(e => e.id)
  } else {
    selected.value = []
  }
}

function toggleRow(id: string, checked: boolean) {
  if (checked) {
    selected.value = [...selected.value, id]
  } else {
    selected.value = selected.value.filter(x => x !== id)
  }
}

async function refreshInbox() {
  await api('/api/inbox/sync', { method: 'POST' })
  await refresh()
  toast.add({ title: 'Inbox refreshed', color: 'success' })
}

async function processSelected() {
  const senders = new Set(selectedEmails.value.map(e => extractSender(e.sender)))
  if (senders.size > 1) {
    toast.add({
      title: 'Multiple senders selected',
      description: 'Please select emails from only one sender.',
      color: 'error'
    })
    return
  }

  processing.value = true
  processingMessage.value = 'Saving images and running Python script…'
  try {
    const result = await api<{ projectId: string }>('/api/inbox/process', {
      method: 'POST',
      body: { emailIds: selected.value }
    })
    selected.value = []
    await refresh()
    toast.add({
      title: 'Processing complete',
      description: 'Images saved and processed successfully.',
      color: 'success'
    })
    await navigateTo(`/projects/${result.projectId}`)
  } finally {
    processing.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <div>
    <AppLoadingOverlay
      v-if="processing"
      :message="processingMessage"
    />

    <AppPageHeader
      title="Inbox"
      description="Select emails with image attachments from the same sender, then click Process."
    />

    <div class="flex flex-wrap items-center gap-3 mb-4">
      <USelect
        v-model="filter"
        :items="filterOptions"
        class="w-44"
      />
      <UButton
        icon="i-lucide-refresh-cw"
        variant="outline"
        color="neutral"
        :loading="status === 'pending'"
        @click="refreshInbox"
      >
        Refresh now
      </UButton>
      <UButton
        icon="i-lucide-play"
        :disabled="!canProcess"
        @click="processSelected"
      >
        Process
      </UButton>
    </div>

    <UCard>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default text-left text-muted">
              <th class="p-3 w-10">
                <UCheckbox
                  :model-value="selected.length > 0 && selected.length === emails.filter(e => e.has_image_attachments && !e.processed).length"
                  @update:model-value="toggleAll(!!$event)"
                />
              </th>
              <th class="p-3">
                From
              </th>
              <th class="p-3">
                Subject
              </th>
              <th class="p-3">
                Received
              </th>
              <th class="p-3">
                Images
              </th>
              <th class="p-3">
                Status
              </th>
              <th class="p-3">
                Message
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="email in emails"
              :key="email.id"
              class="border-b border-default/60 hover:bg-elevated/40"
            >
              <td class="p-3">
                <UCheckbox
                  :model-value="selected.includes(email.id)"
                  :disabled="!email.has_image_attachments || email.processed"
                  @update:model-value="toggleRow(email.id, !!$event)"
                />
              </td>
              <td class="p-3 max-w-48 truncate">
                {{ email.sender }}
              </td>
              <td class="p-3 max-w-64 truncate">
                {{ email.subject }}
              </td>
              <td class="p-3 whitespace-nowrap">
                {{ formatDate(email.received_at) }}
              </td>
              <td class="p-3">
                {{ email.attachment_count }}
              </td>
              <td class="p-3">
                <AppStatusBadge :status="email.status" />
              </td>
              <td class="p-3 text-muted max-w-xs truncate">
                {{ email.status_message || '—' }}
              </td>
            </tr>
            <tr v-if="emails.length === 0">
              <td
                colspan="7"
                class="p-8 text-center text-muted"
              >
                No emails found. Click Refresh now after configuring Zoho IMAP in .env.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
