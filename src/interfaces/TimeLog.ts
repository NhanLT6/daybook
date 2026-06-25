export interface TimeLog {
  id: string;
  date: string; // 'YYYY-MM-DD'
  project: string;
  task: string;
  duration?: number; // undefined = plan entry
  type: 'log' | 'plan';
  description?: string;
}