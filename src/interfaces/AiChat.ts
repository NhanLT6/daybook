import type { ExtractLogsInput, ExtractedLog } from './aiTools';
import type { CatchUpRenderItem } from './CatchUp';
import type { UIDataTypes, UIMessage } from 'ai';

// Re-export so existing `@/interfaces/AiChat` importers keep working
export type { ExtractedLog } from './aiTools';

export type ChatTool = 'extractLogs' | 'catchUp';

export interface DaybookMessageMetadata {
  tool?: ChatTool;
  extractedLogs?: ExtractedLog[];
  saveState?: 'saved' | 'discarded';
  catchUpItems?: CatchUpRenderItem[];
}

// Tools the client knows about — types the `tool-extractLogs` message parts so
// `part.input` is `ExtractLogsInput` instead of `unknown`. Must be a `type`
// (not `interface`) to satisfy the SDK's `UITools = Record<string, UITool>`.
export type DaybookUITools = {
  extractLogs: { input: ExtractLogsInput; output: never };
};

// Typed UIMessage used throughout this app
export type DaybookUIMessage = UIMessage<DaybookMessageMetadata, UIDataTypes, DaybookUITools>;
