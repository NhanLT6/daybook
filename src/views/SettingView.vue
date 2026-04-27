<script setup lang="ts">
import { computed, ref } from 'vue';

import { useCategories } from '@/composables/useCategories';
import { useJira } from '@/composables/useJira';
import { useServerSettings } from '@/composables/useServerSettings';

import { useField, useForm } from 'vee-validate';
import * as yup from 'yup';

import dayjs from 'dayjs';

import { useSettingsStore } from '@/stores/settings';
import { toast } from 'vue-sonner';

const settingsStore = useSettingsStore();
const { sortedCategories } = useCategories();

const { isTesting, isSyncing, testConnection, syncTicketsToLocalStorage } = useJira();

const { saveSettings } = useServerSettings();
const showApiToken = ref(false);
const showGeminiKey = ref(false);
const isSavingSettings = ref(false);

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
];

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

const dateFormatPreview = computed(() => {
  const today = dayjs();
  return today.format(settingsStore.dateDisplayFormat);
});

// Match weekend pattern by value (sorted comparison handles any order)
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

/**
 * Save both Jira and Gemini config to the server.
 * Called via an explicit Save button — settings are no longer auto-saved.
 */
const handleSaveCredentials = async () => {
  isSavingSettings.value = true;
  try {
    const ok = await saveSettings({
      jiraConfig: settingsStore.jiraConfig,
      geminiConfig: settingsStore.geminiConfig,
    });
    if (ok) toast.success('Settings saved');
    else toast.error('Failed to save settings');
  } finally {
    isSavingSettings.value = false;
  }
};

const handleSyncTickets = async (): Promise<void> => {
  try {
    const { fetched, saved } = await syncTicketsToLocalStorage();
    toast.success(`Fetched ${fetched} ticket(s), saved ${saved} new ticket(s)`);
  } catch (error) {
    toast.error('Failed to sync Jira tickets', {
      description: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};
</script>

<template>
  <div class="h-100 overflow-y-auto">
    <div class="settings-grid">
      <!-- App Configuration: two independent islands stacked in the column -->
      <div class="d-flex flex-column settings-col">
        <!-- Date & Calendar island -->
        <VCard class="glass-acrylic">
          <VCardTitle>Date &amp; Calendar</VCardTitle>
          <VCardText class="d-flex flex-column ga-2">
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

            <VSelect
              v-model="settingsStore.firstDayOfWeek"
              :items="settingsStore.firstDayOfWeekOptions"
              label="First day of week"
              item-title="label"
              item-value="value"
              persistent-hint
              hint="This option changes which day is the first day of the week in Calendar component"
            />

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
          </VCardText>
        </VCard>

        <!-- Features island -->
        <VCard class="glass-acrylic">
          <VCardTitle>Features</VCardTitle>
          <VCardText class="d-flex flex-column ga-2">
            <VSwitch
              v-model="settingsStore.useDefaultTasks"
              label="Use Default Tasks"
              persistent-hint
              hint="When enabled, provides a default set of common tasks (Daily meeting, Code review, etc.) to help you get started quickly"
              color="primary"
            />

            <VSwitch
              v-model="settingsStore.useCategories"
              label="Enable Categories"
              persistent-hint
              hint="When enabled, projects can be grouped into categories for better organisation"
              color="primary"
            />
          </VCardText>
        </VCard>

        <!-- Background island -->
        <VCard class="glass-acrylic">
          <VCardTitle>Background</VCardTitle>
          <VCardText class="d-flex flex-column ga-2">
            <VTextField
              v-model="settingsStore.backgroundImageUrl"
              label="Image URL"
              placeholder="https://images.pexels.com/..."
              clearable
              persistent-hint
              hint="Paste any public image URL. Leave empty to use the default animated background."
              prepend-inner-icon="mdi-image-outline"
            />

            <VSelect
              v-if="settingsStore.backgroundImageUrl"
              v-model="settingsStore.backgroundImageMode"
              :items="settingsStore.backgroundModeOptions"
              label="Display Mode"
              item-title="label"
              item-value="value"
              persistent-hint
              :hint="
                settingsStore.backgroundModeOptions.find((o) => o.value === settingsStore.backgroundImageMode)
                  ?.description
              "
            />

            <VSlider
              v-model="settingsStore.backgroundBlur"
              label="Glass Effect"
              :min="0"
              :max="1"
              :step="0.1"
              thumb-label
              show-ticks="always"
              color="primary"
              persistent-hint
              hint="Controls both blur and opacity of all glass surfaces. Higher = more readable over busy backgrounds, lower = more transparent."
            />
          </VCardText>
        </VCard>
      </div>

      <!-- Jira Integration: single island -->
      <div>
        <VCard class="glass-acrylic">
          <VCardTitle class="d-flex align-center justify-space-between" style="min-height: 64px">
            Jira Integration
            <VSwitch v-model="settingsStore.jiraConfig.enabled" color="primary" hide-details density="compact" />
          </VCardTitle>

          <VCardText class="d-flex flex-column ga-2">
            <!-- Connection group -->
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
            >
              <template #details>
                <div class="text-caption text-medium-emphasis">
                  Get your API token at
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary text-decoration-none"
                  >
                    Atlassian API Tokens
                  </a>
                </div>
              </template>
            </VTextField>

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

            <div class="d-flex ga-2">
              <VBtn
                :disabled="!settingsStore.jiraConfig.enabled"
                :loading="isTesting"
                color="primary"
                variant="tonal"
                @click="testConnection"
                class="flex-grow-1"
                prepend-icon="mdi-test-tube"
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

            <!-- Divider between connection group and category group -->
            <VDivider class="my-4" />

            <!-- Category group -->
            <VSelect
              v-model="settingsStore.jiraConfig.defaultCategoryId"
              :items="sortedCategories"
              item-title="name"
              item-value="id"
              label="Default category for Jira tickets"
              clearable
              :disabled="!settingsStore.jiraConfig.enabled || !settingsStore.useCategories"
              persistent-hint
              hint="Jira tickets synced will be auto-assigned this category"
            />
          </VCardText>
        </VCard>
      </div>

      <!-- AI Assistant section -->
      <div>
        <VCard class="glass-acrylic">
          <VCardTitle class="d-flex align-center justify-space-between" style="min-height: 64px">
            AI Assistant
            <VSwitch v-model="settingsStore.geminiConfig.enabled" color="primary" hide-details density="compact" />
          </VCardTitle>

          <VCardText class="d-flex flex-column ga-2">
            <VAlert type="info" variant="tonal" density="compact" class="text-caption">
              Your API key is stored securely on the server, tied to this browser. It cannot be read by others even if
              they know your machine ID.
            </VAlert>

            <VTextField
              v-model="settingsStore.geminiConfig.apiKey"
              label="Gemini API Key"
              :type="showGeminiKey ? 'text' : 'password'"
              :disabled="!settingsStore.geminiConfig.enabled"
              :append-inner-icon="showGeminiKey ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showGeminiKey = !showGeminiKey"
              clearable
              persistent-hint
            >
              <template #details>
                <div class="text-caption text-medium-emphasis">
                  Get your key at
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary text-decoration-none"
                  >
                    Google AI Studio
                  </a>
                </div>
              </template>
            </VTextField>

            <VCombobox
              v-model="settingsStore.geminiConfig.model"
              :items="GEMINI_MODELS"
              label="Model"
              :disabled="!settingsStore.geminiConfig.enabled"
              persistent-hint
              hint="Select a model or type a custom model ID"
            />

            <div class="d-flex justify-end mt-2">
              <VBtn
                color="primary"
                variant="tonal"
                :loading="isSavingSettings"
                prepend-icon="mdi-content-save-outline"
                @click="handleSaveCredentials"
              >
                Save credentials
              </VBtn>
            </div>
          </VCardText>
        </VCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 12px;
}

/* Stack the two App Config islands vertically with consistent gap */
.settings-col {
  gap: 12px;
}

@media (max-width: 959px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
