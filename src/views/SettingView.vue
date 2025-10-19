<script setup lang="ts">
import { computed, ref } from 'vue';

import { useJira } from '@/composables/useJira';

import { useField, useForm } from 'vee-validate';
import * as yup from 'yup';

import dayjs from 'dayjs';

import { useSettingsStore } from '@/stores/settings';
import { toast } from 'vue-sonner';

const settingsStore = useSettingsStore();

const { isTesting, isSyncing, testConnection, syncTicketsToLocalStorage } = useJira();

const showApiToken = ref(false);

const jiraValidationSchema = yup.object({
  email: yup.string().email('Please enter a valid email address').required('Email is required'),
  domain: yup
    .string()
    .required('Domain is required')
    .min(2, 'Domain must be at least 2 characters')
    .matches(/^[a-zA-Z0-9-]+$/, 'Domain can only contain letters, numbers, and hyphens')
    .test('no-atlassian-suffix', 'Enter only the subdomain (without .atlassian.net)', (value) => {
      if (!value) return true;
      return !value.toLowerCase().includes('atlassian');
    }),
  apiToken: yup.string().required('API Token is required').min(10, 'API Token seems too short'),
  projectKey: yup
    .string()
    .required('Project Key is required')
    .min(2, 'Project Key must be at least 2 characters')
    .max(10, 'Project Key must be at most 10 characters'),
  statuses: yup
    .string()
    .required('At least one status is required')
    .test('has-valid-statuses', 'Please enter at least one valid status', (value) => {
      if (!value) return false;
      const statuses = value
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return statuses.length > 0;
    }),
});

useForm({
  validationSchema: jiraValidationSchema,
});

// Set up individual field validation with two-way binding to settings store
const emailField = useField<string>(() => settingsStore.jiraConfig.email, {
  validateOnValueUpdate: false, // Only validate on blur
});

const domainField = useField<string>(() => settingsStore.jiraConfig.domain, {
  validateOnValueUpdate: false,
});

const apiTokenField = useField<string>(() => settingsStore.jiraConfig.apiToken, {
  validateOnValueUpdate: false,
});

const projectKeyField = useField<string>(() => settingsStore.jiraConfig.projectKey, {
  validateOnValueUpdate: false,
});

const statusesField = useField<string>(() => settingsStore.jiraConfig.statuses, {
  validateOnValueUpdate: false,
});

// Smart domain detection from email when user finishes typing (on blur)
const handleEmailBlur = () => {
  // First, trigger validation
  emailField.handleBlur();

  // Then, auto-detect domain from email
  const email = settingsStore.jiraConfig.email;

  // Only autofill domain if it's currently empty
  if (!settingsStore.jiraConfig.domain && email && email.includes('@')) {
    const domainPart = email.split('@')[1];
    if (!domainPart) return;

    settingsStore.jiraConfig.domain = domainPart.split('.')[0].toLowerCase();
  }
};

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
    toast.error('Failed to sync Jira tickets', {
      description: error instanceof Error ? error.message : 'Unknown error occurred',
    });
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

          <VTextField
            v-model="settingsStore.jiraConfig.email"
            label="Email"
            type="email"
            placeholder="your-email@company.com"
            :disabled="!settingsStore.jiraConfig.enabled"
            :error-messages="settingsStore.jiraConfig.enabled ? emailField.errorMessage.value : undefined"
            @blur="handleEmailBlur"
          />

          <VTextField
            v-model="settingsStore.jiraConfig.domain"
            label="Domain"
            placeholder="your-company"
            :disabled="!settingsStore.jiraConfig.enabled"
            :error-messages="settingsStore.jiraConfig.enabled ? domainField.errorMessage.value : undefined"
            @blur="domainField.handleBlur"
            persistent-hint
            hint="Your Jira subdomain only (e.g., 'acme' from 'acme.atlassian.net', not 'acme.com')"
          />

          <VTextField
            v-model="settingsStore.jiraConfig.apiToken"
            label="API Token"
            :type="showApiToken ? 'text' : 'password'"
            :disabled="!settingsStore.jiraConfig.enabled"
            :error-messages="settingsStore.jiraConfig.enabled ? apiTokenField.errorMessage.value : undefined"
            @blur="apiTokenField.handleBlur"
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
            :error-messages="settingsStore.jiraConfig.enabled ? projectKeyField.errorMessage.value : undefined"
            @blur="projectKeyField.handleBlur"
            persistent-hint
            hint="Your project key (e.g., 'ABC' from ticket 'ABC-123')"
          />

          <VTextField
            v-model="settingsStore.jiraConfig.statuses"
            label="Ticket Statuses"
            placeholder="To Do;In Progress;Done"
            :disabled="!settingsStore.jiraConfig.enabled"
            :error-messages="settingsStore.jiraConfig.enabled ? statusesField.errorMessage.value : undefined"
            @blur="statusesField.handleBlur"
            persistent-hint
            hint="Statuses to fetch, separated by semicolon (;). Example: To Do;In Progress;In Review;Done;QA"
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
