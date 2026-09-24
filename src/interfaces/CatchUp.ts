export interface CatchUpRenderItem {
  project: string;
  text: string;
  ongoing: boolean;
  effortLabel?: string;
  group?: 'did' | 'todo' | 'notes'; // notes: open checklist items / questions from sticky notes
}
