<script setup lang="ts">
import { computed, ref } from 'vue';

import { useAuth } from '@/composables/useAuth';

/**
 * Sign-in surface for the server-backed features. Signing in is optional — time
 * logging works entirely offline — so this is a quiet affordance in the dock
 * rather than a gate in front of the app.
 */

const { user, isAuthenticated, isLoading, error, isAuthConfigured, signInEmail, signUpEmail, signInGoogle, signOut } =
  useAuth();

const isDialogOpen = ref(false);
const mode = ref<'signin' | 'signup'>('signin');
const email = ref('');
const password = ref('');
const name = ref('');
const showPassword = ref(false);

const isSignUp = computed(() => mode.value === 'signup');
const canSubmit = computed(
  () => email.value.trim().length > 3 && password.value.length >= 8 && (!isSignUp.value || name.value.trim().length > 0),
);

const initials = computed(() => {
  const source = user.value?.name || user.value?.email || '';
  return source.slice(0, 1).toUpperCase() || '?';
});

const openDialog = () => {
  mode.value = 'signin';
  password.value = '';
  isDialogOpen.value = true;
};

const submit = async () => {
  if (!canSubmit.value) return;
  const ok = isSignUp.value
    ? await signUpEmail(email.value.trim(), password.value, name.value.trim())
    : await signInEmail(email.value.trim(), password.value);
  if (ok) {
    isDialogOpen.value = false;
    password.value = '';
  }
};
</script>

<template>
  <!-- Nothing to show when the deployment has no auth configured at all -->
  <template v-if="isAuthConfigured">
    <!-- Signed in: avatar menu -->
    <VMenu v-if="isAuthenticated" location="bottom end" :offset="8">
      <template #activator="{ props }">
        <VBtn icon variant="text" size="small" v-bind="props" aria-label="Account">
          <VAvatar size="26" color="primary" variant="tonal">
            <VImg v-if="user?.image" :src="user.image" alt="" />
            <span v-else class="text-caption">{{ initials }}</span>
          </VAvatar>
        </VBtn>
      </template>

      <VList class="glass-acrylic" rounded="lg" min-width="200">
        <VListItem :title="user?.name || 'Signed in'" :subtitle="user?.email" />
        <VDivider class="my-1" />
        <VListItem rounded="lg" prepend-icon="mdi-logout" title="Sign out" @click="signOut" />
      </VList>
    </VMenu>

    <!-- Signed out: sign-in entry point -->
    <VBtn v-else class="text-none d-none d-sm-flex" size="small" variant="text" @click="openDialog"> Sign in </VBtn>
    <VIconBtn v-if="!isAuthenticated" icon="mdi-login" size="small" variant="text" class="d-sm-none" @click="openDialog" />

    <VDialog v-model="isDialogOpen" max-width="420">
      <VCard class="glass-acrylic">
        <VCardTitle>{{ isSignUp ? 'Create an account' : 'Sign in' }}</VCardTitle>

        <VCardText class="d-flex flex-column ga-3">
          <VAlert type="info" variant="tonal" density="compact" class="text-caption">
            Signing in is only needed for AI and Jira. Your logs stay on this device either way.
          </VAlert>

          <VBtn variant="outlined" prepend-icon="mdi-google" :loading="isLoading" @click="signInGoogle">
            Continue with Google
          </VBtn>

          <VDivider class="my-1" />

          <VTextField v-if="isSignUp" v-model="name" label="Name" autocomplete="name" density="comfortable" />

          <VTextField v-model="email" label="Email" type="email" autocomplete="email" density="comfortable" />

          <VTextField
            v-model="password"
            label="Password"
            :type="showPassword ? 'text' : 'password'"
            :autocomplete="isSignUp ? 'new-password' : 'current-password'"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            density="comfortable"
            :hint="isSignUp ? 'At least 8 characters' : undefined"
            persistent-hint
            @click:append-inner="showPassword = !showPassword"
            @keyup.enter="submit"
          />

          <VAlert v-if="error" type="error" variant="tonal" density="compact" class="text-caption">
            {{ error }}
          </VAlert>
        </VCardText>

        <VCardActions class="px-4 pb-4 d-flex">
          <VBtn
            variant="text"
            size="small"
            class="text-none"
            @click="mode = isSignUp ? 'signin' : 'signup'"
          >
            {{ isSignUp ? 'I already have an account' : 'Create an account' }}
          </VBtn>
          <VSpacer />
          <VBtn variant="text" @click="isDialogOpen = false">Cancel</VBtn>
          <VBtn color="primary" variant="tonal" :disabled="!canSubmit" :loading="isLoading" @click="submit">
            {{ isSignUp ? 'Sign up' : 'Sign in' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </template>
</template>
