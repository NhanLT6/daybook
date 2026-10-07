import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AiConfig } from '../../../src/interfaces/ServerSettings';
import { aiErrorMessage, isAiAvailable, resolveAi } from '../ai';

const base: AiConfig = { enabled: false, apiKey: '', model: 'gemini-2.5-flash' };
const legacyOwn: AiConfig = { ...base, enabled: true, apiKey: 'key' }; // saved before `mode` existed
const off: AiConfig = { ...base, mode: 'off' };
const shared: AiConfig = { ...base, mode: 'default' };
const ownWithKey: AiConfig = { ...base, mode: 'own', enabled: true, apiKey: 'key' };
const ownNoKey: AiConfig = { ...base, mode: 'own', enabled: true };

afterEach(() => vi.unstubAllEnvs());

describe('isAiAvailable', () => {
  it('keeps the old behaviour for settings saved before modes: own key only, while the gateway is off', () => {
    expect(isAiAvailable(base)).toBe(false);
    expect(isAiAvailable({ ...base, enabled: true })).toBe(false); // switched on but no key
    expect(isAiAvailable(legacyOwn)).toBe(true);
  });

  it('gives unconfigured users the shared gateway once the deployment enables it', () => {
    vi.stubEnv('AI_GATEWAY_ENABLED', 'true');
    expect(isAiAvailable(base)).toBe(true);
    expect(isAiAvailable(legacyOwn)).toBe(true);
  });

  it('honours an explicit choice', () => {
    expect(isAiAvailable(shared)).toBe(false); // gateway not enabled on this deployment
    expect(isAiAvailable(ownWithKey)).toBe(true);
    expect(isAiAvailable(ownNoKey)).toBe(false);

    vi.stubEnv('AI_GATEWAY_ENABLED', 'true');
    expect(isAiAvailable(shared)).toBe(true);
    expect(isAiAvailable(off)).toBe(false); // off stays off even with the gateway on
    expect(isAiAvailable(ownNoKey)).toBe(false); // own with no key does not silently use the gateway
  });
});

describe('resolveAi', () => {
  it('refuses to run when AI is not available', () => {
    expect(() => resolveAi(off)).toThrow('not set up');
    expect(() => resolveAi(ownNoKey)).toThrow('not set up');
  });

  it('uses the gateway with privacy routing in shared mode', () => {
    vi.stubEnv('AI_GATEWAY_ENABLED', 'true');
    const { model, providerOptions } = resolveAi(shared);
    expect(model).toBe('openai/gpt-5.4-nano');
    expect(providerOptions).toEqual({ gateway: { disallowPromptTraining: true, zeroDataRetention: true } });
  });

  it('lets AI_GATEWAY_MODEL and AI_GATEWAY_ZDR=false override the defaults', () => {
    vi.stubEnv('AI_GATEWAY_ENABLED', 'true');
    vi.stubEnv('AI_GATEWAY_MODEL', 'google/gemini-2.5-flash');
    vi.stubEnv('AI_GATEWAY_ZDR', 'false');
    const { model, providerOptions } = resolveAi(shared);
    expect(model).toBe('google/gemini-2.5-flash');
    expect(providerOptions?.gateway.zeroDataRetention).toBe(false);
    expect(providerOptions?.gateway.disallowPromptTraining).toBe(true);
  });

  it("uses the user's own key, not the gateway, in own mode", () => {
    vi.stubEnv('AI_GATEWAY_ENABLED', 'true');
    const { model, providerOptions } = resolveAi(ownWithKey);
    expect(typeof model).not.toBe('string'); // a Google provider model, not a gateway id
    expect(providerOptions).toBeUndefined();
  });
});

describe('aiErrorMessage', () => {
  it('explains an exhausted shared quota and points at the own-key option', () => {
    vi.stubEnv('AI_GATEWAY_ENABLED', 'true');
    expect(aiErrorMessage({ statusCode: 402 }, shared)).toContain('quota');
    expect(aiErrorMessage({ statusCode: 402 }, shared)).toContain('own Gemini key');
  });

  it('keeps own-key failures generic', () => {
    expect(aiErrorMessage({ statusCode: 402 }, ownWithKey)).toBe('AI request failed. Check your API key in Settings.');
  });
});
