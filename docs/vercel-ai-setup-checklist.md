# AI Setup Checklist (own Gemini key, with an optional shared Vercel AI Gateway)

Daybook's AI features (chat, extract logs, Catch up) run one of three ways, chosen per user in
**Settings → AI Assistant**:

| Mode | What runs | Billed to |
|---|---|---|
| **Off** | nothing — chat and Catch up are unavailable | — |
| **Shared** | the deployment's Vercel AI Gateway (`AI_GATEWAY_MODEL`, default `openai/gpt-5.4-nano`) | the deployment owner's gateway credit |
| **Own key** | the user's Gemini key and model (`@ai-sdk/google`) | the user's Google account |

The shared gateway is **off by default**: Vercel asks for a payment card before the free monthly credit applies.
Until `AI_GATEWAY_ENABLED=true` is set on the deployment, the "Shared" button is greyed out and AI works only
through users' own keys (exactly how the app behaved before the gateway existed). Turn it on when you're ready.

Settings saved before modes existed keep working: an own key that was switched on stays "Own key"; otherwise the
user gets "Shared" once the gateway is enabled, and "Off" until then. Mode is stored as `aiConfig.mode` in the
existing JSON column — no migration (`resolveAiMode` in `src/interfaces/ServerSettings.ts`).

Only signed-in users reach `/api/chat` and `/api/standup` (Neon Auth token), so the gateway credit is not open to
anonymous traffic.

## 1. Deployment env vars

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL`, `VITE_NEON_AUTH_URL` | From the Neon integration | ✅ Yes (settings + auth) |
| `AI_GATEWAY_ENABLED` | `true` to turn the shared gateway on | ❌ Optional — unset = own keys only |
| `AI_GATEWAY_API_KEY` | Vercel dashboard → AI Gateway → API Keys | Local dev only. On Vercel the deployment's OIDC token is used automatically. |
| `AI_GATEWAY_MODEL` | A gateway model id, e.g. `google/gemini-2.5-flash` | ❌ Optional — overrides the default `openai/gpt-5.4-nano` |
| `AI_GATEWAY_ZDR` | `false` | ❌ Optional — see the next section |

## 2. Privacy: no training, no retention

Every gateway request sets both routing options, so the gateway only picks providers that satisfy them:

- `disallowPromptTraining: true` — providers with a no-training agreement with Vercel. Available on every plan.
- `zeroDataRetention: true` — providers with a zero-data-retention agreement. **Per-request ZDR is a Pro/Enterprise
  gateway feature**, so on a Hobby team the gateway may reject these requests (the app then shows "No AI provider
  met the privacy requirements"). Options: upgrade to Pro, or set `AI_GATEWAY_ZDR=false` to drop only the retention
  requirement (no-training stays on).

If no provider can satisfy the options for the chosen model, the gateway answers `400 no_providers_available`; pick a
different `AI_GATEWAY_MODEL` rather than loosening the options.

Users who bring their own key bypass the gateway, so these options do not apply to them — their data is governed by
their own Google terms.

### Model check (Vercel model browser, saved 2026-10-07)

Filter: free-tier credit + no-training provider + zero-data-retention provider + vision + tool use. All three pass; p50 latency/throughput are Vercel's measured figures.

| Model | Input / output per 1M tokens | Time to first token | Tokens/s |
|---|---|---|---|
| `google/gemini-2.5-flash` | $0.30 / $2.50 | ~380 ms | ~185 |
| `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | ~270 ms | ~405 |
| `openai/gpt-5.4-nano` (default) | $0.20 / $1.25 | ~630 ms | ~165 |

Newer Gemini models (3.x) are not on the free-tier credit. The default is a small reasoning model, picked from the
list rather than benchmarked — after turning the gateway on, check that chat still extracts logs (including "the
rest of the day") correctly, and swap via `AI_GATEWAY_MODEL` if not.

## 3. Cost and limits

- Each Vercel team gets **$5 of gateway credit per month** on the free-tier model list, at provider list price with no
  markup, and the credit stops being recurring once credits are purchased. Free-tier requests are rate-limited per model.
- With no purchased credit, running out should simply fail requests rather than bill you (verify in the dashboard's
  spend settings). `aiErrorMessage` maps the gateway's credit (402) and rate-limit (429) errors to a message that points
  the user at their own key.
- `maxOutputTokens` is capped at 2048 per request (`MAX_OUTPUT_TOKENS`) so one runaway generation can't eat the credit.
- Check usage in the Vercel dashboard → AI Gateway.

## 4. Verify

- [ ] With `AI_GATEWAY_ENABLED=true`, Settings → AI Assistant → **Shared**, saved: AI Chat streams a reply (Vercel dashboard → AI Gateway shows the request)
- [ ] "Catch up" in the chat returns items
- [ ] With **Own key** and a valid key, the request does **not** show in the gateway log
- [ ] Without `AI_GATEWAY_ENABLED`, "Shared" is greyed out and a user with no key sees "AI Assistant is not set up"
- [ ] Signed out, AI requests fail with the sign-in error rather than reaching the gateway
- [ ] On Hobby: if requests fail with the privacy message, set `AI_GATEWAY_ZDR=false` and redeploy

## Switching models or providers

- Gateway model: set `AI_GATEWAY_MODEL` (browse https://vercel.com/ai-gateway/models; the model needs tool calling and
  image input for the chat). Redeploy.
- Own-key provider: swap the SDK in `resolveAi` (`api/_lib/ai.ts`) and the model list in `src/views/SettingView.vue`.
