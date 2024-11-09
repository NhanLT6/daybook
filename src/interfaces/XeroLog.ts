export interface XeroLog {
  id: string;
  date: string; // 'YYYY-MM-DD'
  project: string;
  task: string;
  duration: number;
  description?: string;
}
