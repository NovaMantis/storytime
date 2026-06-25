<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface ProjectSummary {
  id: string
  senderEmail: string
  status: string
  imageCount: number
  updatedAt: string
}

const { data, status } = await useFetch<{ projects: ProjectSummary[] }>('/api/projects')

const projects = computed(() => data.value?.projects ?? [])

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Projects"
      description="Projects created from processed email images."
    />

    <div
      v-if="status === 'pending'"
      class="text-muted"
    >
      Loading projects…
    </div>

    <div
      v-else-if="projects.length === 0"
      class="text-muted"
    >
      No projects yet. Process emails from the Inbox to create one.
    </div>

    <div
      v-else
      class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <UCard
        v-for="project in projects"
        :key="project.id"
        class="hover:ring-1 hover:ring-primary/30 transition"
      >
        <div class="flex flex-col gap-3">
          <div class="flex items-start justify-between gap-2">
            <p class="font-medium truncate">
              {{ project.senderEmail }}
            </p>
            <AppStatusBadge :status="project.status" />
          </div>
          <p class="text-sm text-muted">
            {{ project.imageCount }} image{{ project.imageCount === 1 ? '' : 's' }}
            · Updated {{ formatDate(project.updatedAt) }}
          </p>
          <UButton
            :to="`/projects/${project.id}`"
            variant="soft"
            color="neutral"
            block
          >
            Open project
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
