<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface ProjectSummary {
  id: string
  senderEmail: string
  status: string
  imageCount: number
  updatedAt: string
  pendingReview: boolean
}

const { data, status, refresh } = await useFetch<{ projects: ProjectSummary[] }>('/api/projects')

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
            <span v-if="project.pendingReview">Awaiting image review</span>
            <span v-else>{{ project.imageCount }} image{{ project.imageCount === 1 ? '' : 's' }}</span>
            · Updated {{ formatDate(project.updatedAt) }}
          </p>
          <UButton
            :to="project.pendingReview ? `/projects/${project.id}/review` : `/projects/${project.id}`"
            variant="soft"
            color="neutral"
            block
          >
            {{ project.pendingReview ? 'Review images' : 'Open project' }}
          </UButton>
          <AppDeleteProjectButton
            :project-id="project.id"
            :project-label="project.senderEmail"
            block
            @deleted="refresh()"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
