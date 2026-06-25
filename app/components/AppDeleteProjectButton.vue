<script setup lang="ts">
const props = withDefaults(defineProps<{
  projectId: string
  projectLabel: string
  redirect?: boolean
  block?: boolean
}>(), {
  redirect: false,
  block: false
})

const emit = defineEmits<{ deleted: [] }>()

const open = ref(false)
const deleting = ref(false)
const router = useRouter()
const toast = useToast()
const { api } = useApi()

async function confirmDelete() {
  deleting.value = true
  try {
    await api(`/api/projects/${props.projectId}`, { method: 'DELETE' })
    toast.add({ title: 'Project deleted', color: 'success' })
    open.value = false
    emit('deleted')
    if (props.redirect) {
      await router.push('/projects')
    }
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Delete project"
    :description="`Delete ${projectLabel}? This removes all images, notes, and PDFs. Linked emails will return to the inbox as unprocessed.`"
    :dismissible="!deleting"
    :ui="{ footer: 'justify-end gap-2' }"
  >
    <UButton
      color="error"
      variant="outline"
      icon="i-lucide-trash-2"
      :block="block"
      @click="open = true"
    >
      Delete
    </UButton>

    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="outline"
        :disabled="deleting"
        @click="open = false"
      />
      <UButton
        label="Delete project"
        color="error"
        :loading="deleting"
        @click="confirmDelete"
      />
    </template>
  </UModal>
</template>
