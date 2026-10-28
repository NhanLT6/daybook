import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { resolveAiMode, type AiConfig, type AiMode } from '../../src/interfaces/ServerSettings.js';

// Vercel AI Gateway model id (provider/model). Cheap ($0.10 / $0.50 per 1M, half of gpt-5.4-nano and a newer
// generation), multimodal (the chat takes screenshots) and supports tool calling. AI_GATEWAY_MODEL overrides it.
const DEFAULT_GATEWAY_MODEL = 'openai/gpt-6-luna';
const FALLBACK_BYOK_MODEL = 'gemini-2.5-flash';

/**
 * Tokens a single answer may use. A cap on the shared gateway credit: a runaway generation can't drain
 * it, and no chat or standup reply here comes close.
 */
export const MAX_OUTPUT_TOKENS = 2048;

/**
 * The shared gateway is opt-in for the deployment: until the owner is ready to fund it (Vercel asks for a
 * card before the free credit applies), leave AI_GATEWAY_ENABLED unset and AI runs on each user's own key only.
 */
export function isGatewayEnabled(): boolean {
  return process.env.AI_GATEWAY_ENABLED === 'true';
}

/** What the user chose in Settings, falling back to the old behaviour for settings saved before the choice existed. */
export function aiModeOf(config: AiConfig): AiMode {
  return resolveAiMode(config);
}

/** True when the request runs on the user's own Gemini key (billed to them). */
export function usesOwnKey(config: AiConfig): boolean {
  return aiModeOf(config) === 'own' && !!config.apiKey;
}

/**
 * AI can answer when it has something to run on: the user's own key, or the shared gateway (only if
 * the deployment enabled it, which production always does).
 */
export function isAiAvailable(config: AiConfig): boolean {
  const mode = aiModeOf(config);
  return mode === 'default' ? isGatewayEnabled() : mode === 'own' && !!config.apiKey;
}

/**
 * Which model answers, and the per-request routing options to pass alongside it. Callers check
 * isAiAvailable first.
 *
 * "own": the user's Gemini key, billed to them. "default": Vercel AI Gateway — a plain `provider/model`
 * string, authenticated by the deployment's OIDC token (or AI_GATEWAY_API_KEY when running locally). Only
 * the signed-in users of this app reach it, and the gateway's own monthly credit is the spending ceiling.
 *
 * Every gateway request is routed only to providers that don't train on prompts. Zero data retention is
 * on as well, but is a Pro/Enterprise gateway feature — set AI_GATEWAY_ZDR=false to turn it off on a Hobby
 * team, where requiring it would reject every request.
 */
export function resolveAi(config: AiConfig) {
  if (!isAiAvailable(config)) throw new Error('AI Assistant is not set up.');

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

/** The reply when AI isn't usable yet; the chat links its "Settings" word off this wording. */
export const AI_NOT_SET_UP_MESSAGE = 'AI Assistant is not set up. Choose how it should run in Settings.';

interface GatewayLikeError {
  statusCode?: number;
  type?: string;
  message?: string;
  cause?: unknown;
  lastError?: unknown;
}

/**
 * Status, type and messages from the whole error chain: the AI SDK wraps the gateway error (a
 * RetryError keeps it as `lastError`, other wrappers as `cause`), so the first status/type found wins
 * and every message is kept for matching.
 */
function readGatewayError(err: unknown): { statusCode?: number; type?: string; message: string } {
  const found: { statusCode?: number; type?: string; message: string } = { message: '' };
  let current = err as GatewayLikeError | undefined;
  for (let depth = 0; current && typeof current === 'object' && depth < 4; depth++) {
    found.statusCode ??= current.statusCode;
    found.type ??= current.type;
    if (current.message) found.message += ` ${current.message}`;
    current = (current.lastError ?? current.cause) as GatewayLikeError | undefined;
  }
  return found;
}

/**
 * Message for a failed AI call. The gateway signals a reached budget or exhausted credit (402,
 * `quota_for_entity_exceeded`), a burst past its rate limit (429) and "no provider meets the privacy
 * options" (400) in ways the user can act on, so those get plain wording; anything else stays generic
 * rather than echoing provider internals. The AI SDK maps types it doesn't know (like the quota one)
 * to an internal error, so the status code and message are what identify a budget hit.
 */
export function aiErrorMessage(err: unknown, config: AiConfig): string {
  const { statusCode, type, message } = readGatewayError(err);

  if (usesOwnKey(config)) return 'AI request failed. Check your API key in Settings.';

  const quotaHit =
    statusCode === 402 ||
    type === 'insufficient_funds' ||
    type === 'quota_for_entity_exceeded' ||
    /budget exceeded|quota limit exceeded/i.test(message);
  if (quotaHit) {
    return 'The shared AI quota for this month is used up. You can add your own Gemini key in Settings.';
  }
  if (statusCode === 429 || type === 'rate_limit_exceeded') {
    return 'The shared AI is busy right now. Try again in a minute, or add your own Gemini key in Settings.';
  }
  if (type === 'no_providers_available') {
    return 'No AI provider met the privacy requirements (no training, zero data retention). Ask the owner to review AI_GATEWAY_ZDR / AI_GATEWAY_MODEL.';
  }
  return "The shared AI couldn't answer right now. Try again in a moment.";
}
