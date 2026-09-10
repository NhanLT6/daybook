export interface Note {
  id: string;
  content: string; // Tiptap HTML
  order: number; // ascending; new notes get (first.order - 1) so they appear first
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}
