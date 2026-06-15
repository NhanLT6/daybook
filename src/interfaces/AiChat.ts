import type { UIMessage } from 'ai';

import type { CatchUpRenderItem } from './CatchUp';

export interface ExtractedLog {
  project: string;
  task: string;
  date: string; // 'YYYY-MM-DD'
  duration: number; // minutes
  description?: string;
}

export type ChatTool = 'extractLogs' | 'catchUp';

export interface DaybookMessageMetadata {
  tool?: ChatTool;
  extractedLogs?: ExtractedLog[];
  saveState?: 'saved' | 'discarded';
  timestamp?: number;
  catchUpItems?: CatchUpRenderItem[];
}

// Typed UIMessage used throughout this app
export type DaybookUIMessage = UIMessage<DaybookMessageMetadata>;
