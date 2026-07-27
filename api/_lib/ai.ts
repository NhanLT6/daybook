import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AiConfig } from '../../src/interfaces/ServerSettings.js';

const FALLBACK_MODEL = 'gemini-2.5-flash';

/**
 * AI is per-user: the key comes from the caller's own KV-stored settings, never
 * from a deployment-wide env var. A public deployment must not spend the
 * owner's Gemini quota on behalf of strangers.
 */
export function isAiEnabled(config: AiConfig): boolean {
  return config.enabled && !!config.apiKey;
}

export function requireAiModel(config: AiConfig) {
  if (!isAiEnabled(config)) throw new Error('AI Assistant is not configured.');
  return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model || FALLBACK_MODEL);
}
