export interface TaskEntry {
  id: string;
  date: Date;
  project: string;
  task: string;
  duration: number | undefined;
  description?: string;
  isLogged?: boolean;
  type?: 'log' | 'plan';
}
