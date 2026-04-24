import { computed, ref } from 'vue';

import type { DaybookMessageMetadata, DaybookUIMessage, ExtractedLog } from '@/interfaces/AiChat';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { FileUIPart, TextUIPart, UIMessage } from 'ai';

import { Chat } from '@ai-sdk/vue';
import { DefaultChatTransport } from 'ai';

import { buildAuthHeaders } from './useCrypto';

// ── Pure helpers (exported for unit tests) ────────────────────────────────

const JSON_BLOCK_RE = /```json\s*([\s\S]*?)\s*```/;

export function parseLogsFromText(text: string): ExtractedLog[] {
  const match = text.match(JSON_BLOCK_RE);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? (parsed as ExtractedLog[]) : [];
  } catch {
    return [];
  }
}

export function stripJsonBlock(text: string): string {
  return text.replace(JSON_BLOCK_RE, '').trim();
}

// ── Image helper ──────────────────────────────────────────────────────────

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Composable ────────────────────────────────────────────────────────────

export function useAiChat() {
  const error = ref<string | null>(null);
  const latestLogsMessageId = ref<string | null>(null);
  const savedLogsMessageId = ref<string | null>(null);

  // App-specific metadata keyed by message id — SDK messages carry no app state
  const metadataMap = ref(new Map<string, DaybookMessageMetadata>());

  const chat = new Chat<DaybookUIMessage>({
    transport: new DefaultChatTransport<DaybookUIMessage>({
      headers: () => buildAuthHeaders(),
    }),
    onFinish: ({ messages: finished }) => {
      const last = finished[finished.length - 1];
      if (!last || last.role !== 'assistant') return;

      const rawText = last.parts
        .filter((p): p is TextUIPart => p.type === 'text')
        .map((p) => p.text)
        .join('');

      const logs = parseLogsFromText(rawText);

      metadataMap.value = new Map(metadataMap.value).set(last.id, {
        timestamp: Date.now(),
        ...(logs.length > 0 ? { extractedLogs: logs } : {}),
      });

      if (logs.length > 0) {
        latestLogsMessageId.value = last.id;
      }
    },
    onError: (err: Error) => {
      error.value = err.message;
    },
  });

  // Merge SDK messages with our app metadata
  const messages = computed<DaybookUIMessage[]>(() =>
    (chat.messages as UIMessage[]).map((m) => ({
      ...m,
      metadata: metadataMap.value.get(m.id),
    })),
  );

  // True while request is in-flight or tokens are arriving
  const isLoading = computed(() => chat.status === 'submitted' || chat.status === 'streaming');

  const sendMessage = async (text: string, attachedFile: File | null, projects: Project[], tasks: Task[]) => {
    if (!text.trim() && !attachedFile) return;

    error.value = null;
    // Freeze the undo window — new message commits the previous save permanently
    savedLogsMessageId.value = null;

    const fileParts: FileUIPart[] = [];
    if (attachedFile) {
      const { base64, mimeType } = await fileToBase64(attachedFile);
      fileParts.push({
        type: 'file',
        mediaType: mimeType,
        url: `data:${mimeType};base64,${base64}`,
        filename: attachedFile.name,
      });
    }

    await chat.sendMessage(
      {
        ...(text.trim() ? { text } : {}),
        ...(fileParts.length > 0 ? { files: fileParts } : {}),
      } as Parameters<typeof chat.sendMessage>[0],
      {
        body: {
          projects: projects.map((p) => p.title),
          tasks: tasks.map((t) => ({ project: t.project, title: t.title })),
          currentDate: new Date().toISOString().split('T')[0],
        },
      },
    );
  };

  const markSaved = (id: string) => {
    const existing = metadataMap.value.get(id) ?? {};
    metadataMap.value = new Map(metadataMap.value).set(id, { ...existing, saveState: 'saved' });
    savedLogsMessageId.value = id;
  };

  const markUndone = (id: string) => {
    const existing = metadataMap.value.get(id) ?? {};
    metadataMap.value = new Map(metadataMap.value).set(id, { ...existing, saveState: undefined });
    savedLogsMessageId.value = null;
    latestLogsMessageId.value = id;
  };

  const markDiscarded = (id: string) => {
    const existing = metadataMap.value.get(id) ?? {};
    metadataMap.value = new Map(metadataMap.value).set(id, {
      ...existing,
      saveState: 'discarded',
    });
    if (latestLogsMessageId.value === id) latestLogsMessageId.value = null;
  };

  const clearMessages = () => {
    chat.messages = [];
    metadataMap.value = new Map();
    latestLogsMessageId.value = null;
    savedLogsMessageId.value = null;
    error.value = null;
  };

  return {
    messages,
    isLoading,
    error,
    latestLogsMessageId,
    savedLogsMessageId,
    sendMessage,
    markSaved,
    markUndone,
    markDiscarded,
    clearMessages,
  };
}
