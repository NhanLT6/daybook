import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Stand-in for Neon's client: each getSession() call returns the next queued result.
const getSession = vi.fn();
vi.mock('@neondatabase/auth', () => ({
  createInternalNeonAuth: () => ({ adapter: { getSession }, getJWTToken: vi.fn() }),
}));

const signedIn = { data: { user: { id: 'u1', email: 'a@x' } } };
const signedOut = { data: null };

async function loadUseAuth() {
  const { useAuth } = await import('@/composables/useAuth');
  const auth = useAuth();
  await auth.ready;
  return auth;
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useAuth session re-check', () => {
  beforeEach(() => {
    // The client and session state are module-level, so every test needs a fresh module.
    vi.resetModules();
    vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.example.test/neondb/auth');
    vi.useFakeTimers();
    getSession.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('picks up a session the first load missed, after a short delay', async () => {
    getSession.mockResolvedValueOnce(signedOut).mockResolvedValueOnce(signedIn);
    const auth = await loadUseAuth();
    expect(auth.isAuthenticated.value).toBe(false);

    await vi.advanceTimersByTimeAsync(2000);
    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.user.value?.id).toBe('u1');
  });

  it('re-checks when the tab becomes visible again', async () => {
    getSession.mockResolvedValue(signedOut);
    const auth = await loadUseAuth();
    await vi.advanceTimersByTimeAsync(2000);
    expect(auth.isAuthenticated.value).toBe(false);

    getSession.mockResolvedValue(signedIn);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(auth.isAuthenticated.value).toBe(true);
  });

  it('never signs a signed-in user out, even if a later check fails', async () => {
    getSession.mockResolvedValueOnce(signedIn).mockRejectedValue(new Error('network down'));
    const auth = await loadUseAuth();
    expect(auth.isAuthenticated.value).toBe(true);

    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(2000);
    expect(auth.isAuthenticated.value).toBe(true);
    // Signed in already, so no re-check was made at all.
    expect(getSession).toHaveBeenCalledTimes(1);
  });
});
