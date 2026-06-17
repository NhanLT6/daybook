import { createGoogleGenerativeAI } from '@ai-sdk/google';

export function isAiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function requireAiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('AI is not configured on this deployment.');
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  return createGoogleGenerativeAI({ apiKey })(model);
}
