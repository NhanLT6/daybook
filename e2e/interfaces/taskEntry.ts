export interface TaskEntry {
  id: string;
  date: Date;
  project: string;
  task: string;
  duration: number;
  description?: string;
  isLogged?: boolean;
}
