import type { UIMessage } from 'ai';

export interface ExtractedLog {
  project: string;
  task: string;
  date: string; // 'YYYY-MM-DD'
  duration: number; // minutes
  description?: string;
}

export interface DaybookMessageMetadata {
  extractedLogs?: ExtractedLog[];
  saveState?: 'saved' | 'discarded';
  timestamp?: number;
}

// Typed UIMessage used throughout this app
export type DaybookUIMessage = UIMessage<DaybookMessageMetadata>;
