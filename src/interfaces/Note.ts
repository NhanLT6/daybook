// Each maps to a `note-<color>` theme color in main.ts (light + dark variants)
export const NOTE_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export interface Note {
  id: string;
  content: string; // Tiptap HTML
  order: number; // ascending; new notes get (first.order - 1) so they appear first
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  pinned?: boolean; // optional: notes saved before v2 lack it
  color?: NoteColor; // unset = default surface
}
