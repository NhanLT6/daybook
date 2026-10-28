import type {
  AddEventInput,
  AddNoteInput,
  AddedItemOutput,
  ExtractLogsInput,
  ExtractLogsOutput,
  ExtractedLog,
  SearchNotesInput,
  SearchNotesOutput,
} from './aiTools';
import type { CatchUpRenderItem } from './CatchUp';
import type { UIDataTypes, UIMessage } from 'ai';

// Re-export so existing `@/interfaces/AiChat` importers keep working
export type { ExtractedLog } from './aiTools';

/** An extracted log as the card shows it: flags names the user doesn't have yet (saving adds them). */
export type ChatLog = ExtractedLog & { newProject?: boolean; newTask?: boolean; newCategory?: boolean };

export type ChatTool = 'extractLogs' | 'catchUp' | 'welcome';

export interface DaybookMessageMetadata {
  tool?: ChatTool;
  extractedLogs?: ChatLog[];
  saveState?: 'saved' | 'discarded';
  catchUpItems?: CatchUpRenderItem[];
}

// Tools the client knows about — types the `tool-<name>` message parts so
// `part.input` is typed instead of `unknown`. Must be a `type`
// (not `interface`) to satisfy the SDK's `UITools = Record<string, UITool>`.
export type DaybookUITools = {
  extractLogs: { input: ExtractLogsInput; output: ExtractLogsOutput };
  searchNotes: { input: SearchNotesInput; output: SearchNotesOutput };
  addNote: { input: AddNoteInput; output: AddedItemOutput };
  addEvent: { input: AddEventInput; output: AddedItemOutput };
};

// Typed UIMessage used throughout this app
export type DaybookUIMessage = UIMessage<DaybookMessageMetadata, UIDataTypes, DaybookUITools>;
