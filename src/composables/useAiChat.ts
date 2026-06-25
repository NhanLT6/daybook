import { computed, ref } from 'vue';

import type { CatchUpRenderItem } from '@/interfaces/CatchUp';
import type { DaybookMessageMetadata, DaybookUIMessage, ExtractedLog } from '@/interfaces/AiChat';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { DynamicToolUIPart, FileUIPart, UIMessage } from 'ai';

import { Chat } from '@ai-sdk/vue';
import { DefaultChatTransport } from 'ai';

import { buildAuthHeaders } from './useCrypto';

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

      // Find extractLogs dynamic tool invocation from the AI SDK
      const toolPart = last.parts.find(
        (p) =>
          p.type === 'dynamic-tool' &&
          (p as DynamicToolUIPart).toolName === 'extractLogs' &&
          (p as DynamicToolUIPart).state === 'input-available',
      ) as (DynamicToolUIPart & { state: 'input-available' }) | undefined;

      const logs = (toolPart?.input as { logs?: ExtractedLog[] })?.logs ?? [];

      metadataMap.value = new Map(metadataMap.value).set(last.id, {
        timestamp: Date.now(),
        ...(logs.length > 0 ? { tool: 'extractLogs' as const, extractedLogs: logs } : {}),
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

  const injectCatchUp = (items: CatchUpRenderItem[]) => {
    const id = `catchup-${Date.now()}`;
    // Plain-text bullet list for AI conversation context (follow-up questions)
    const hasGroups = items.some((i) => i.group);
    const text = hasGroups
      ? [
          'Did:',
          ...items.filter((i) => i.group === 'did').map((i) => `• ${i.text}${i.effortLabel ? ` · ${i.effortLabel}` : ''}`),
          '',
          'Todo:',
          ...items.filter((i) => i.group === 'todo').map((i) => `• ${i.text}`),
        ].join('\n')
      : items.map((i) => `• ${i.text}${i.effortLabel ? ` · ${i.effortLabel}` : ''}`).join('\n');

    const syntheticMsg = {
      id,
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text }],
      content: text,
    };
    chat.messages = [...chat.messages, syntheticMsg as unknown as DaybookUIMessage];
    metadataMap.value = new Map(metadataMap.value).set(id, {
      timestamp: Date.now(),
      tool: 'catchUp' as const,
      catchUpItems: items,
    });
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
    injectCatchUp,
    clearMessages,
  };
}
