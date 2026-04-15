import { ref } from 'vue'
import { nanoid } from 'nanoid'
import { buildAuthHeaders } from './useCrypto'
import type { ChatMessage, ExtractedLog } from '@/interfaces/AiChat'
import type { Task } from '@/interfaces/Task'
import type { Project } from '@/interfaces/Project'

// ── Pure helpers (exported for unit tests) ────────────────────────────────

const JSON_BLOCK_RE = /```json\s*([\s\S]*?)\s*```/

export function parseLogsFromText(text: string): ExtractedLog[] {
  const match = text.match(JSON_BLOCK_RE)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[1])
    return Array.isArray(parsed) ? (parsed as ExtractedLog[]) : []
  } catch {
    return []
  }
}

export function stripJsonBlock(text: string): string {
  return text.replace(JSON_BLOCK_RE, '').trim()
}

// ── Image helpers ─────────────────────────────────────────────────────────

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip "data:image/png;base64," prefix — Gemini wants raw base64
      const base64 = dataUrl.split(',')[1]
      resolve({ base64, mimeType: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Composable ────────────────────────────────────────────────────────────

export function useAiChat() {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  // Track the ID of the last AI message containing logs — only that one is saveable
  const latestLogsMessageId = ref<string | null>(null)

  const sendMessage = async (
    text: string,
    attachedFile: File | null,
    projects: Project[],
    tasks: Task[],
  ) => {
    if (!text.trim() && !attachedFile) return

    error.value = null

    // Build user message
    let imageBase64: string | undefined
    let imageMimeType: string | undefined
    let imageDataUrl: string | undefined

    if (attachedFile) {
      const converted = await fileToBase64(attachedFile)
      imageBase64 = converted.base64
      imageMimeType = converted.mimeType
      // Keep data URL for display in the user bubble
      imageDataUrl = `data:${imageMimeType};base64,${imageBase64}`
    }

    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: text,
      imageBase64: imageDataUrl,
      timestamp: Date.now(),
    }
    messages.value.push(userMessage)
    isLoading.value = true

    try {
      const authHeaders = await buildAuthHeaders()

      // Build message history in our simple format.
      // The API handler converts to AI SDK CoreMessage format internally.
      const allMessages = messages.value.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          messages: allMessages,
          projects: projects.map((p) => p.title),
          tasks: tasks.map((t) => ({ project: t.project, title: t.title })),
          currentDate: new Date().toISOString().split('T')[0],
          imageBase64,
          imageMimeType,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error ?? 'Request failed')
      }

      const { text: responseText } = await res.json()
      const extractedLogs = parseLogsFromText(responseText)
      const displayText = stripJsonBlock(responseText)

      const aiMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: displayText,
        extractedLogs: extractedLogs.length > 0 ? extractedLogs : undefined,
        timestamp: Date.now(),
      }
      messages.value.push(aiMessage)

      // This is now the only saveable message
      if (extractedLogs.length > 0) {
        latestLogsMessageId.value = aiMessage.id
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Something went wrong'
    } finally {
      isLoading.value = false
    }
  }

  const clearMessages = () => {
    messages.value = []
    latestLogsMessageId.value = null
    error.value = null
  }

  return {
    messages,
    isLoading,
    error,
    latestLogsMessageId,
    sendMessage,
    clearMessages,
  }
}
