# AI Provider Research — Future Reference

**Date:** 2026-06-17  
**Status:** Reference only — current deployment uses Gemini. Revisit when Gemini free limits become unusable.

---

## Why this was written

Google reduced Gemini free tier limits significantly in December 2025 (Flash dropped from ~250 to 20 req/day, partially recovered). The trend suggests further reductions. This doc captures the research for when a provider swap is needed.

---

## Current app usage profile

- Personal/small team app (~1–20 users)
- ~5–20 AI API calls per day
- Two AI endpoints: standup summary (structured JSON) and chat assistant (tool calling + streaming)
- Requirements: tool/function calling, streaming, strict structured JSON output, no-card free tier

---

## Provider comparison

| Provider | Free limit | Tool calling | Streaming | No card | Notes |
|---|---|---|---|---|---|
| **Gemini Flash** | ~1,500 req/day (mid-2026) | ✅ | ✅ | ✅ | Trend: declining; Pro no longer free |
| **Cerebras** | 1,000 req/day, 1M tokens/day | ✅ | ✅ | ✅ | Best structured JSON, API data not used for training |
| **Groq** | 1,000 req/day, 30 RPM | ✅ | ✅ | ✅ | Fast, OpenAI-compatible, good fallback |
| **OpenRouter (free)** | Varies by model | ✅ | ✅ | ✅ | Avoid: privacy/routing complexity, stability varies |
| **Mistral free** | Unclear/limited | ✅ | ✅ | ✅ | Data used for training on free tier |
| **GitHub Models** | Limited | ✅ | ✅ | ✅ | Better for experimentation, not production |
| **Hugging Face** | Very limited | Partial | Partial | ✅ | Too small for production use |

---

## Recommendation (from research)

### Primary: Cerebras

**Model:** `gpt-oss-120b`

Best overall for this app:
- Genuine daily free limits (not one-time credits)
- Strong structured JSON / schema support → clean for standup summary
- Tool calling + streaming → works for chat assistant
- API data not used for training by default

### Fallback: Groq

**Models:** `qwen/qwen3-32b` or `llama-3.3-70b-versatile`

Use when Cerebras is rate-limited or unavailable. Fast inference, generous enough free tier, good for both summarization and chat. Validate JSON output with Zod (slightly less strict than Cerebras on schema adherence).

### Avoid for this app

- **OpenRouter free models** — privacy/routing complexity, downstream provider stability varies
- **Cloudflare Workers AI** — free quota uses "Neurons" which is hard to estimate

---

## Recommended implementation pattern (when switching)

1. Try Cerebras primary
2. If rate-limited or unavailable, fallback to Groq
3. Always validate JSON with Zod (already in place for chat tools)
4. Retry once on invalid JSON
5. Keep prompts short and cap max output tokens

---

## Implementation notes

The codebase uses a thin `api/_lib/aiConfig.ts` wrapper that reads env vars and returns `{ enabled, apiKey, model }`. When switching providers:

1. Update `aiConfig.ts` to read the new provider's env var (e.g. `CEREBRAS_API_KEY`)
2. In `standup.ts` and `chat.ts`, swap the SDK import (`@ai-sdk/google` → `@ai-sdk/cerebras` or similar)
3. Update `GEMINI_API_KEY` → `CEREBRAS_API_KEY` in Vercel environment variables
4. Optionally keep `GEMINI_MODEL` → `CEREBRAS_MODEL` pattern

For a Cerebras + Groq fallback setup, extend `aiConfig.ts` to return both configs and add retry logic in the API handlers.
