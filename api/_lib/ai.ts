import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AiConfig } from '../../src/interfaces/ServerSettings.js';

// Vercel AI Gateway model id (provider/model). Fast, multimodal (the chat takes screenshots), supports
// tool calling, and on the gateway's free-tier list — the same model the BYOK default has always used.
const DEFAULT_GATEWAY_MODEL = 'google/gemini-2.5-flash';
const FALLBACK_BYOK_MODEL = 'gemini-2.5-flash';

/**
 * Tokens a single answer may use. A cap on the shared gateway credit: a runaway generation can't drain
 * it, and no chat or standup reply here comes close.
 */
export const MAX_OUTPUT_TOKENS = 2048;

/**
 * True when the caller switched on their own Gemini key (Settings → AI Assistant). That key is billed to
 * them and overrides the shared gateway.
 */
export function usesOwnKey(config: AiConfig): boolean {
  return config.enabled && !!config.apiKey;
}

/**
 * Which model answers, and the per-request routing options to pass alongside it.
 *
 * Default: Vercel AI Gateway — a plain `provider/model` string, authenticated by the deployment's OIDC
 * token (or AI_GATEWAY_API_KEY when running locally). Only the signed-in users of this app reach it, and
 * the gateway's own monthly credit is the spending ceiling.
 *
 * Every gateway request is routed only to providers that don't train on prompts. Zero data retention is
 * on as well, but is a Pro/Enterprise gateway feature — set AI_GATEWAY_ZDR=false to turn it off on a Hobby
 * team, where requiring it would reject every request.
 */
export function resolveAi(config: AiConfig) {
  if (usesOwnKey(config)) {
    return {
      model: createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model || FALLBACK_BYOK_MODEL),
      providerOptions: undefined,
    };
  }

  return {
    model: process.env.AI_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        zeroDataRetention: process.env.AI_GATEWAY_ZDR !== 'false',
      },
    },
  };
}

interface GatewayLikeError {
  statusCode?: number;
  type?: string;
  message?: string;
}

/**
 * Message for a failed AI call. The gateway signals an exhausted credit (402), a burst past its
 * free-tier rate limit (429) and "no provider meets the privacy options" (400) in ways the user can act
 * on, so those get plain wording; anything else stays generic rather than echoing provider internals.
 */
export function aiErrorMessage(err: unknown, config: AiConfig): string {
  const { statusCode, type } = (err ?? {}) as GatewayLikeError;
  const hint = usesOwnKey(config) ? 'Check your API key in Settings.' : 'You can add your own Gemini key in Settings.';

  if (!usesOwnKey(config)) {
    if (statusCode === 402 || type === 'insufficient_funds') {
      return `The shared AI quota for this month is used up. ${hint}`;
    }
    if (statusCode === 429 || type === 'rate_limit_exceeded') {
      return 'The shared AI is busy right now. Try again in a minute, or add your own Gemini key in Settings.';
    }
    if (type === 'no_providers_available') {
      return 'No AI provider met the privacy requirements (no training, zero data retention). Ask the owner to review AI_GATEWAY_ZDR / AI_GATEWAY_MODEL.';
    }
  }
  return `AI request failed. ${hint}`;
}
