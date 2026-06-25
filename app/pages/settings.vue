<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface Settings {
  imagePrompt: string
  imageModel: string
  textPrompt: string
  textModel: string
}

const toast = useToast()
const { api } = useApi()

const { data: settings, refresh } = await useFetch<Settings>('/api/settings')

const imagePrompt = ref('')
const imageModel = ref('')
const textPrompt = ref('')
const textModel = ref('')
const savingImage = ref(false)
const savingText = ref(false)

watch(settings, (value) => {
  if (!value) return
  imagePrompt.value = value.imagePrompt
  imageModel.value = value.imageModel
  textPrompt.value = value.textPrompt
  textModel.value = value.textModel
}, { immediate: true })

async function saveImageSettings() {
  savingImage.value = true
  try {
    await api<Settings>('/api/settings', {
      method: 'PATCH',
      body: {
        imagePrompt: imagePrompt.value,
        imageModel: imageModel.value
      }
    })
    await refresh()
    toast.add({ title: 'Image settings saved', color: 'success' })
  } finally {
    savingImage.value = false
  }
}

async function saveTextSettings() {
  savingText.value = true
  try {
    await api<Settings>('/api/settings', {
      method: 'PATCH',
      body: {
        textPrompt: textPrompt.value,
        textModel: textModel.value
      }
    })
    await refresh()
    toast.add({ title: 'Text settings saved', color: 'success' })
  } finally {
    savingText.value = false
  }
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Settings"
      description="Configure how images are enhanced and text is extracted when you process inbox emails."
    />

    <div class="space-y-6">
      <UCard>
        <template #header>
          <p class="font-medium">
            Image processing
          </p>
          <p class="text-sm text-muted">
            OpenAI model and prompt used when enhancing drawings from email attachments.
          </p>
        </template>

        <div class="space-y-4">
          <UFormField label="Model">
            <UInput
              v-model="imageModel"
              placeholder="gpt-image-1.5"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Prompt">
            <UTextarea
              v-model="imagePrompt"
              :rows="8"
              placeholder="Describe how images should be enhanced…"
              class="w-full"
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton
              :loading="savingImage"
              :disabled="!imagePrompt.trim() || !imageModel.trim()"
              @click="saveImageSettings"
            >
              Save
            </UButton>
          </div>
        </template>
      </UCard>

      <UCard>
        <template #header>
          <p class="font-medium">
            Text extraction
          </p>
          <p class="text-sm text-muted">
            OpenAI model and prompt used when transcribing handwritten text from storybook pages.
          </p>
        </template>

        <div class="space-y-4">
          <UFormField label="Model">
            <UInput
              v-model="textModel"
              placeholder="gpt-4o"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Prompt">
            <UTextarea
              v-model="textPrompt"
              :rows="8"
              placeholder="Describe how handwritten text should be transcribed…"
              class="w-full"
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton
              :loading="savingText"
              :disabled="!textPrompt.trim() || !textModel.trim()"
              @click="saveTextSettings"
            >
              Save
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
