import { computed, ref } from 'vue';

import type { CatchUpRenderItem } from '@/interfaces/CatchUp';
import type { DaybookMessageMetadata, DaybookUIMessage, ExtractedLog } from '@/interfaces/AiChat';
import type { AddedItemOutput, ExtractLogsInput, ServerChatCommand } from '@/interfaces/aiTools';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { FileUIPart } from 'ai';

import { Chat } from '@ai-sdk/vue';
import { DefaultChatTransport, getToolName, isToolUIPart, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';

import { plainTextToNoteHtml } from '@/common/plainTextToNoteHtml';
import { sanitizeNoteHtml } from '@/common/sanitizeNoteHtml';
import { searchNotes } from '@/common/searchNotes';
import { addEventInputSchema, addNoteInputSchema, searchNotesInputSchema } from '@/interfaces/aiTools';
import { nanoid } from 'nanoid';
import { useSettingsStore } from '@/stores/settings';

import { authHeaders } from './useAuth';
import { dailyTargetMinutes } from './useDailyTarget';
import { useEvents } from './useEvents';
import { useNotes } from './useNotes';

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

// ── Tool-part reader ────────────────────────────────────────────────────────

/**
 * Derive extracted logs from a message's parts. Static AI SDK tools stream as
 * `tool-extractLogs` parts (not `dynamic-tool`); this is the single place that
 * reads them, so it is unit-tested against SDK part shapes.
 */
export function extractLogsFromMessage(message: Pick<DaybookUIMessage, 'parts'>): ExtractedLog[] {
  const part = message.parts.find(
    (p) => isToolUIPart(p) && getToolName(p) === 'extractLogs' && p.state === 'input-available',
  );
  const input = part && 'input' in part ? (part.input as ExtractLogsInput | undefined) : undefined;
  return input?.logs ?? [];
}

// ── Client-side tools ───────────────────────────────────────────────────────

// Notes and events only exist in this browser's IndexedDB, so the tools that read or
// write them run here and send their result back to the model.
const CLIENT_TOOLS = ['searchNotes', 'addNote', 'addEvent'] as const;
type ClientTool = (typeof CLIENT_TOOLS)[number];
const isClientTool = (name: string): name is ClientTool => (CLIENT_TOOLS as readonly string[]).includes(name);

async function runClientTool(name: ClientTool, input: unknown) {
  if (name === 'searchNotes') {
    const { notes, ready } = useNotes();
    await ready;
    return searchNotes(notes.value, searchNotesInputSchema.parse(input));
  }

  if (name === 'addNote') {
    const { text } = addNoteInputSchema.parse(input);
    const { saveNote, nextTopOrder, ready } = useNotes();
    await ready;
    const now = Date.now();
    const id = nanoid();
    await saveNote({
      id,
      content: sanitizeNoteHtml(plainTextToNoteHtml(text)),
      order: nextTopOrder(),
      createdAt: now,
      updatedAt: now,
    });
    return { saved: true, id } satisfies AddedItemOutput;
  }

  const event = addEventInputSchema.parse(input);
  // Reject what the Events form would reject, rather than storing an event the calendar can't draw
  if (event.endDate && event.endDate < event.date) return { saved: false, error: 'endDate is before date' };
  if (event.endTime && !event.startTime) return { saved: false, error: 'endTime needs a startTime' };
  const { addEvent, ready } = useEvents();
  await ready;
  const id = nanoid();
  await addEvent({ ...event, endDate: event.endDate === event.date ? undefined : event.endDate, id, type: 'custom' });
  return { saved: true, id } satisfies AddedItemOutput;
}

/** Undo an addNote / addEvent save from the chat. */
export async function removeAddedItem(tool: 'addNote' | 'addEvent', id: string) {
  if (tool === 'addNote') await useNotes().removeNote(id);
  else await useEvents().removeEvent(id);
}

// ── Composable ────────────────────────────────────────────────────────────

export function useAiChat() {
  const settingsStore = useSettingsStore();
  const error = ref<string | null>(null);
  const latestLogsMessageId = ref<string | null>(null);
  const savedLogsMessageId = ref<string | null>(null);

  // App-specific metadata keyed by message id — SDK messages carry no app state
  const metadataMap = ref(new Map<string, DaybookMessageMetadata>());

  // Kept on the transport (not per sendMessage) so the automatic follow-up request
  // after a client-side tool result carries the same context.
  let requestBody: Record<string, unknown> = {};

  const chat = new Chat<DaybookUIMessage>({
    transport: new DefaultChatTransport<DaybookUIMessage>({
      headers: async () => (await authHeaders()) ?? {},
      body: () => requestBody,
    }),
    onToolCall: async ({ toolCall }) => {
      if (toolCall.dynamic || !isClientTool(toolCall.toolName)) return;
      const tool = toolCall.toolName;
      try {
        const output = await runClientTool(tool, toolCall.input);
        // Not awaited: awaiting addToolOutput inside onToolCall can deadlock the chat job queue
        void chat.addToolOutput({ tool, toolCallId: toolCall.toolCallId, output } as Parameters<
          typeof chat.addToolOutput
        >[0]);
      } catch {
        void chat.addToolOutput({
          tool,
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText: tool === 'searchNotes' ? 'Could not read notes' : 'Could not save',
        });
      }
    },
    // Send client tool results back so the model can answer or confirm. extractLogs never
    // gets an output, so a turn that extracted logs does not resubmit.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: ({ messages: finished }) => {
      const last = finished[finished.length - 1];
      if (!last || last.role !== 'assistant') return;

      // extractedLogs are derived from message parts in `messages` (below); here
      // we only record which message currently owns the saveable log preview.
      if (extractLogsFromMessage(last).length > 0) {
        latestLogsMessageId.value = last.id;
      }
    },
    onError: (err: Error) => {
      error.value = err.message;
    },
  });

  // Merge SDK messages with app state. extractLogs metadata is derived from the
  // tool part (single source = SDK parts); the map only holds client-only state
  // (saveState) and fully client-injected catch-up messages.
  const messages = computed<DaybookUIMessage[]>(() =>
    (chat.messages as DaybookUIMessage[]).map((m) => {
      const stored = metadataMap.value.get(m.id);
      // Catch-up messages are injected client-side and carry their own metadata.
      if (stored?.tool === 'catchUp') return { ...m, metadata: stored };

      const logs = extractLogsFromMessage(m);
      const metadata: DaybookMessageMetadata | undefined =
        logs.length || stored
          ? { ...stored, ...(logs.length ? { tool: 'extractLogs', extractedLogs: logs } : {}) }
          : undefined;
      return { ...m, metadata };
    }),
  );

  // True while request is in-flight or tokens are arriving
  const isLoading = computed(() => chat.status === 'submitted' || chat.status === 'streaming');

  // `command`: the slash command the text starts with, if any. The text keeps its `/note` prefix
  // so the conversation history still shows what each message was.
  const sendMessage = async (
    text: string,
    attachedFile: File | null,
    projects: Project[],
    tasks: Task[],
    command?: ServerChatCommand,
  ) => {
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

    requestBody = {
      projects: projects.map((p) => p.title),
      tasks: tasks.map((t) => ({ project: t.project, title: t.title })),
      currentDate: new Date().toISOString().split('T')[0],
      // The user's workday length for "rest of the day" phrasing; null = no daily target
      workdayMinutes: dailyTargetMinutes(settingsStore.dailyTargetEnabled, settingsStore.dailyTargetHours),
      ...(command ? { command } : {}),
    };

    await chat.sendMessage({
      ...(text.trim() ? { text } : {}),
      ...(fileParts.length > 0 ? { files: fileParts } : {}),
    } as Parameters<typeof chat.sendMessage>[0]);
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
    const section = (title: string, group: CatchUpRenderItem['group']) => {
      const lines = items
        .filter((i) => i.group === group)
        .map((i) => `• ${i.text}${i.effortLabel ? ` · ${i.effortLabel}` : ''}`);
      return lines.length ? [title, ...lines, ''] : [];
    };
    const text = hasGroups
      ? [...section('Did:', 'did'), ...section('Todo:', 'todo'), ...section('From notes:', 'notes')].join('\n').trim()
      : items.map((i) => `• ${i.text}${i.effortLabel ? ` · ${i.effortLabel}` : ''}`).join('\n');

    const syntheticMsg = {
      id,
      role: 'assistant' as const,
      parts: [{ type: 'text' as const, text }],
      content: text,
    };
    chat.messages = [...chat.messages, syntheticMsg as unknown as DaybookUIMessage];
    metadataMap.value = new Map(metadataMap.value).set(id, {
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
