export interface ExtractedLog {
  project: string
  task: string
  date: string       // 'YYYY-MM-DD'
  duration: number   // minutes
  description?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string           // natural-language text part
  imageBase64?: string      // base64 data URL for display (user messages only)
  extractedLogs?: ExtractedLog[]  // parsed from AI response (assistant only)
  timestamp: number
}
