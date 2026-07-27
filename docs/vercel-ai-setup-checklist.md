# AI Setup Checklist (bring your own key)

Daybook's AI features run on **each user's own Gemini key**, entered in the app.
There is no deployment-wide key.

## Why not an env var?

This repo is public and the Vercel deployment is reachable by anyone. `verifyRequest`
(`api/_lib/auth.ts`) only proves the caller holds the private key matching the
`machineId` it presents — every visitor can mint a valid keypair in their browser. It
isolates users from each other; it does not gate who may call the API.

So a `GEMINI_API_KEY` env var would be a shared credential: anyone hitting
`/api/chat` or `/api/standup` on the deployment would spend the owner's Gemini
quota. Keys are per-user instead, stored in Upstash KV under the caller's own
`machineId`, readable only by whoever holds that machine's private key.

---

## 1. Deployment env vars

| Variable | Value | Required |
|---|---|---|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | From the Upstash integration | ✅ Yes |
| `GEMINI_API_KEY` | — | ❌ **Do not set.** Remove it if present. |
| `GEMINI_MODEL` | — | ❌ Not used. Model is per-user, chosen in Settings. |

If `GEMINI_API_KEY` was ever set on this project, delete it in
**Vercel dashboard → Settings → Environment Variables**, then redeploy — Vercel keeps
serving the old value until the next deployment. Rotate that key at
https://aistudio.google.com/app/apikey, since anyone who used the deployment while it
was set was spending it.

---

## 2. Per-user setup (each person, including the project owner)

1. Get a key at https://aistudio.google.com/app/apikey
2. Open the app → **Settings → AI Assistant**
3. Toggle it on, paste the key, pick a model
4. **Save credentials**

The key goes to `/api/settings` (PUT) and is stored in KV under that browser's
`machineId`. It never appears in the repo or in any build output.

---

## 3. Verify

- [ ] Settings → AI Assistant saves without error, and the key is still there after reload
- [ ] AI Chat tab accepts a message and streams a reply
- [ ] Catch-up notification appears within a minute of opening
- [ ] With the toggle **off**, chat shows "AI Assistant is not configured. Add your Gemini API key in Settings." and the catch-up notification stays silent
- [ ] A fresh browser profile (new `machineId`) sees an empty AI config — not yours

---

## Switching providers in the future

See `docs/superpowers/specs/2026-06-17-ai-provider-research.md` for the provider
comparison. The short version:

1. Swap the SDK import and `createGoogleGenerativeAI` call in `api/_lib/ai.ts`
2. Update the model list (`GEMINI_MODELS`) and field labels in `src/views/SettingView.vue`
3. Keep the key per-user — do not reintroduce a deployment-wide key
