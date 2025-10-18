<script setup lang="ts">
import { computed, ref } from 'vue';

import { useJira } from '@/composables/useJira';

import dayjs from 'dayjs';

import { useSettingsStore } from '@/stores/settings';
import { toast } from 'vue-sonner';

const settingsStore = useSettingsStore();

// TanStack Query style API - loading states are managed by the composable
const { isTesting, isSyncing, testConnection, syncTicketsToLocalStorage } = useJira();

// Password visibility toggle
const showApiToken = ref(false);

// Create a preview of current date format
const dateFormatPreview = computed(() => {
  const today = dayjs();
  return today.format(settingsStore.dateDisplayFormat);
});

// Create a computed property for weekend display
const selectedWeekendPattern = computed({
  get: () => {
    // Find the pattern that matches current weekend days
    const current = settingsStore.weekendPatterns.find(
      (pattern) => JSON.stringify(pattern.value.sort()) === JSON.stringify([...settingsStore.weekendDays].sort()),
    );
    return current || settingsStore.weekendPatterns[0];
  },
  set: (pattern) => {
    settingsStore.weekendDays = pattern.value;
  },
});

const handleSyncTickets = async (): Promise<void> => {
  try {
    const savedTicketCount = await syncTicketsToLocalStorage();
    toast.success(`Successfully synced ${savedTicketCount} ticket(s)`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to sync Jira tickets');
  }
};
</script>

<template>
  <VRow justify="start" class="align-stretch">
    <!-- App Configuration Column -->
    <VCol cols="12" md="6" lg="4" class="d-flex">
      <VCard elevation="0" class="flex-grow-1">
        <VCardTitle class="d-flex align-center" style="min-height: 64px"> App Configuration </VCardTitle>
        <VCardText class="d-flex flex-column ga-2">
          <!-- Date Display Format -->
          <VSelect
            v-model="settingsStore.dateDisplayFormat"
            :items="settingsStore.dateFormatOptions"
            label="Date Display Format"
            item-title="label"
            item-value="value"
            persistent-hint
            :hint="`Preview: ${dateFormatPreview}. Affects date formats in the interface only. Import/export formats remain unchanged.`"
          >
            <template #item="{ props, item }">
              <VListItem v-bind="props" :subtitle="item.raw.example" />
            </template>
          </VSelect>

          <!-- First day of week -->
          <VSelect
            v-model="settingsStore.firstDayOfWeek"
            :items="settingsStore.firstDayOfWeekOptions"
            label="First day of week"
            item-title="label"
            item-value="value"
            persistent-hint
            hint="This option changes which day is the first day of the week in Calendar component"
          >
          </VSelect>

          <!-- Weekend days -->
          <VSelect
            v-model="selectedWeekendPattern"
            :items="settingsStore.weekendPatterns"
            label="Weekend days"
            item-title="label"
            return-object
            persistent-hint
            hint="This option changes which days are highlighted as weekend days in Calendar and affects time tracking calculations"
          >
            <template #item="{ props, item }">
              <VListItem v-bind="props" :subtitle="item.raw.description" />
            </template>
          </VSelect>

          <!-- Use Default Tasks -->
          <VSwitch
            v-model="settingsStore.useDefaultTasks"
            label="Use Default Tasks"
            persistent-hint
            hint="When enabled, provides a default set of common tasks (Daily meeting, Code review, etc.) to help you get started quickly"
            color="primary"
          />
        </VCardText>
      </VCard>
    </VCol>

    <!-- Jira Integration Column -->
    <VCol cols="12" md="6" lg="4" class="d-flex">
      <VCard elevation="0" class="flex-grow-1">
        <VCardTitle class="d-flex align-center justify-space-between" style="min-height: 64px">
          Jira Integration
          <VSwitch v-model="settingsStore.jiraConfig.enabled" color="primary" hide-details density="compact" />
        </VCardTitle>

        <VCardText class="d-flex flex-column ga-2">
          <!-- Security Warning -->
          <VAlert type="warning" variant="tonal" density="compact" class="text-caption">
            <strong>Security Warning:</strong> Your API token is saved in your browser. Anyone with access to your
            computer can read it. Don't use this on shared or public computers. Use only on your personal device and
            change your token often for better security.
          </VAlert>

          <!-- Jira Configuration Fields -->
          <VTextField
            v-model="settingsStore.jiraConfig.domain"
            label="Domain"
            placeholder="your-company"
            :disabled="!settingsStore.jiraConfig.enabled"
            persistent-hint
            hint="Your Jira subdomain only (e.g., 'acme' from 'acme.atlassian.net', not 'acme.com')"
          />

          <VTextField
            v-model="settingsStore.jiraConfig.email"
            label="Email"
            type="email"
            placeholder="your-email@company.com"
            :disabled="!settingsStore.jiraConfig.enabled"
          />

          <VTextField
            v-model="settingsStore.jiraConfig.apiToken"
            label="API Token"
            :type="showApiToken ? 'text' : 'password'"
            :disabled="!settingsStore.jiraConfig.enabled"
            :append-inner-icon="showApiToken ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showApiToken = !showApiToken"
            clearable
            persistent-hint
            hint="Get your API token at https://id.atlassian.com/manage-profile/security/api-tokens"
          />

          <VTextField
            v-model="settingsStore.jiraConfig.projectKey"
            label="Project Key"
            placeholder="ABC"
            :disabled="!settingsStore.jiraConfig.enabled"
            persistent-hint
            hint="Your project key (e.g., 'ABC' from ticket 'ABC-123')"
          />

          <!-- Action Buttons -->
          <div class="d-flex ga-2">
            <VBtn
              :disabled="!settingsStore.jiraConfig.enabled"
              :loading="isTesting"
              color="primary"
              variant="tonal"
              @click="testConnection"
              class="flex-grow-1"
            >
              Test Connection
            </VBtn>

            <VBtn
              :disabled="!settingsStore.jiraConfig.enabled"
              :loading="isSyncing"
              color="success"
              variant="tonal"
              @click="handleSyncTickets"
              class="flex-grow-1"
              prepend-icon="mdi-sync"
            >
              Sync Tickets
            </VBtn>
          </div>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style scoped></style>
