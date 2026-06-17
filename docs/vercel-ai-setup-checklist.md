# Vercel AI Setup Checklist

Run this after deploying a build that uses env-var-based AI config (i.e. after the
"remove AI settings UI" change is deployed).

---

## 1. Add environment variables in Vercel

Go to: **Vercel dashboard → your project → Settings → Environment Variables**

| Variable | Value | Required |
|---|---|---|
| `GEMINI_API_KEY` | Your Google AI Studio API key | ✅ Yes |
| `GEMINI_MODEL` | e.g. `gemini-2.5-flash` | No (defaults to `gemini-2.5-flash`) |

Get your key at: https://aistudio.google.com/app/apikey

Set scope to **Production** (and **Preview** if you want AI in preview deployments).

---

## 2. Redeploy

Vercel does not pick up new env vars until the next deployment.

Trigger a redeploy: **Vercel dashboard → Deployments → Redeploy** (or push a commit).

---

## 3. Verify AI is working

Open the deployed app and check:

- [ ] Catch-up notification appears within a minute of opening (or on next tab return after a day)
- [ ] AI Chat tab loads and accepts a message
- [ ] Standup summary generates correctly in the Catch-up panel

---

## 4. Verify error handling (optional)

Temporarily remove `GEMINI_API_KEY` from Vercel env vars and redeploy. The app should:

- [ ] Not crash — the notification simply doesn't appear
- [ ] Show a clear error message if you trigger the chat or standup endpoints directly

Re-add the key and redeploy when done.

---

## Switching providers in the future

See `docs/superpowers/specs/2026-06-17-ai-provider-research.md` for the provider
comparison and swap instructions. The short version:

1. Replace `GEMINI_API_KEY` with the new provider's key variable (e.g. `CEREBRAS_API_KEY`)
2. Update `api/_lib/aiConfig.ts` to read the new env var name
3. Swap the SDK import in `api/standup.ts` and `api/chat.ts`
4. Redeploy
