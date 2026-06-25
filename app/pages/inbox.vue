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
  archived: boolean
  status: string
  status_message: string | null
  projectId: string | null
  projectSenderEmail: string | null
}

const filter = ref('all')
const withAttachmentsOnly = ref(true)
const emailFilter = ref('')
const debouncedEmailFilter = ref('')
const selected = ref<string[]>([])

let emailFilterTimer: ReturnType<typeof setTimeout> | undefined
watch(emailFilter, (value) => {
  clearTimeout(emailFilterTimer)
  emailFilterTimer = setTimeout(() => {
    debouncedEmailFilter.value = value.trim()
  }, 300)
})
const processing = ref(false)
const archiving = ref(false)
const processingMessage = ref('Processing emails…')
const toast = useToast()
const { api } = useApi()

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Unprocessed', value: 'unprocessed' },
  { label: 'Awaiting review', value: 'awaiting-review' },
  { label: 'Processed', value: 'processed' },
  { label: 'Errors', value: 'errors' },
  { label: 'No images', value: 'no-images' },
  { label: 'Archived', value: 'archived' }
]

const isArchivedView = computed(() => filter.value === 'archived')

const { data, refresh, status } = await useFetch('/api/inbox', {
  query: computed(() => ({
    filter: filter.value,
    withAttachments: withAttachmentsOnly.value && filter.value !== 'no-images' && filter.value !== 'archived' ? undefined : 'false',
    email: debouncedEmailFilter.value.trim() || undefined,
    pageSize: 100
  })),
  watch: [filter, withAttachmentsOnly, debouncedEmailFilter]
})

watch([filter, withAttachmentsOnly, debouncedEmailFilter], () => {
  selected.value = []
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
  !isArchivedView.value
  && selectedEmails.value.length > 0
  && selectedEmails.value.every(e => e.has_image_attachments && e.status === 'pending')
)

const canArchive = computed(() =>
  !isArchivedView.value && selected.value.length > 0
)

const canUnarchive = computed(() =>
  isArchivedView.value && selected.value.length > 0
)

const selectableEmails = computed(() => emails.value)

function toggleAll(checked: boolean) {
  if (checked) {
    selected.value = selectableEmails.value.map(e => e.id)
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

async function archiveSelected(archived: boolean) {
  archiving.value = true
  try {
    const result = await api<{ updated: number }>('/api/inbox/archive', {
      method: 'POST',
      body: { emailIds: selected.value, archived }
    })
    selected.value = []
    await refresh()
    toast.add({
      title: archived ? 'Emails archived' : 'Emails restored',
      description: `${result.updated} email${result.updated === 1 ? '' : 's'} updated.`,
      color: 'success'
    })
  } finally {
    archiving.value = false
  }
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
  processingMessage.value = 'Saving and preprocessing images…'
  try {
    const result = await api<{ projectId: string }>('/api/inbox/process', {
      method: 'POST',
      body: { emailIds: selected.value }
    })
    selected.value = []
    await refresh()
    toast.add({
      title: 'Preprocessing complete',
      description: 'Review images and choose which need AI enhancement.',
      color: 'success'
    })
    await navigateTo(`/projects/${result.projectId}/review`)
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
      :description="isArchivedView
        ? 'Archived emails are hidden from the main inbox. Select emails to restore them.'
        : 'Select emails with image attachments from the same sender, then click Process. Archive emails you want to hide from the inbox.'"
    />

    <div class="flex flex-wrap items-center gap-3 mb-4">
      <USelect
        v-model="filter"
        :items="filterOptions"
        class="w-44"
      />
      <label
        class="inline-flex items-center gap-2 text-sm text-muted cursor-pointer select-none"
        :class="{ 'opacity-50 cursor-not-allowed': filter === 'no-images' || filter === 'archived' }"
      >
        <USwitch
          v-model="withAttachmentsOnly"
          :disabled="filter === 'no-images' || filter === 'archived'"
          aria-label="Only show emails with image attachments"
        />
        With image attachments
      </label>
      <UInput
        v-model="emailFilter"
        icon="i-lucide-search"
        placeholder="Filter by sender email"
        class="w-64"
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
        v-if="!isArchivedView"
        icon="i-lucide-archive"
        variant="outline"
        color="neutral"
        :disabled="!canArchive"
        :loading="archiving"
        @click="archiveSelected(true)"
      >
        Archive
      </UButton>
      <UButton
        v-else
        icon="i-lucide-archive-restore"
        variant="outline"
        color="neutral"
        :disabled="!canUnarchive"
        :loading="archiving"
        @click="archiveSelected(false)"
      >
        Restore
      </UButton>
      <UButton
        v-if="!isArchivedView"
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
                  :model-value="selected.length > 0 && selected.length === selectableEmails.length"
                  :disabled="selectableEmails.length === 0"
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
                <span
                  v-if="email.has_image_attachments"
                  class="inline-flex items-center gap-1.5"
                  :title="`${email.attachment_count} image attachment${email.attachment_count === 1 ? '' : 's'}`"
                >
                  <UIcon
                    name="i-lucide-images"
                    class="size-4 text-primary shrink-0"
                  />
                  {{ email.attachment_count }}
                </span>
                <span
                  v-else
                  class="text-muted"
                >—</span>
              </td>
              <td class="p-3">
                <div class="flex flex-col items-start gap-1.5">
                  <AppStatusBadge :status="email.status" />
                  <NuxtLink
                    v-if="email.projectId"
                    :to="email.status === 'awaiting_review'
                      ? `/projects/${email.projectId}/review`
                      : `/projects/${email.projectId}`"
                    class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    :title="`Linked to project for ${email.projectSenderEmail}`"
                  >
                    <UIcon
                      name="i-lucide-folder"
                      class="size-3.5 shrink-0"
                    />
                    {{ email.projectSenderEmail }}
                  </NuxtLink>
                </div>
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
                No emails found.{{ isArchivedView ? '' : ' Click Refresh now after configuring Zoho IMAP in .env.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
