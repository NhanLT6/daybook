import type { ChatLog } from '@/interfaces/AiChat';
import type { ExtractedLog } from '@/interfaces/aiTools';

/**
 * Tidies the logs the chat model extracted before the user sees them. The model is small and cheap, so the
 * things it gets wrong in a predictable way are fixed here instead of trusted:
 * - names snap to the user's own spelling of a project or task (case, a ticket key without its summary);
 * - a ticket project has no task, so a task repeating the ticket's title or summary is dropped;
 * - "the rest of the day" (`restOfDay`) becomes minutes here: the target minus that day's saved logs and
 *   the other entries of the batch. Models get that arithmetic wrong.
 */

export interface ResolveLogsContext {
  projects: string[]; // every known project title, tickets ("DS-123 Summary") included
  tasks: Array<{ project: string; title: string }>;
  targetMinutes: number | null; // daily target; null = no target, so "the rest" can't be computed
  loggedMinutesOn: (date: string) => number; // time already saved on that day (real logs, not plans)
  categories?: string[]; // category names; absent while categories are off in Settings
  categoryOf?: (project: string) => string | undefined; // a known project's category name
}

// Known project: its own category. New project: the model's pick, spelled like an existing one when it is one
function resolveCategory(log: ExtractedLog, project: string, isNew: boolean, ctx: ResolveLogsContext) {
  if (!ctx.categories) return { category: undefined, newCategory: false };
  if (!isNew) return { category: ctx.categoryOf?.(project), newCategory: false };
  const name = log.category?.trim();
  if (!name) return { category: undefined, newCategory: false };
  const known = ctx.categories.find((c) => same(c, name));
  return { category: known ?? name, newCategory: !known };
}

// "DS-4475" at the start of a name, the way Jira (and most trackers) write issue keys
const TICKET_KEY = /^([A-Z][A-Z0-9]+-\d+)\b/i;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const ticketKeyOf = (title: string): string | undefined => TICKET_KEY.exec(title.trim())?.[1].toUpperCase();

// "DS-1 Login bug" → "Login bug"; empty for a name that isn't a ticket
const ticketSummaryOf = (title: string) => {
  const key = ticketKeyOf(title);
  return key ? title.trim().slice(key.length).trim() : '';
};

function snapProject(name: string, projects: string[]): string {
  const exact = projects.find((p) => same(p, name));
  if (exact) return exact;
  // "DS-4475" or "DS-4475 Redesigned flow" → the ticket's stored title
  const key = ticketKeyOf(name);
  if (key) {
    const ticket = projects.find((p) => ticketKeyOf(p) === key);
    if (ticket) return ticket;
  }
  return name.trim();
}

function snapTask(task: string | undefined, project: string, ctx: ResolveLogsContext): string | undefined {
  const name = task?.trim();
  if (!name) return undefined;
  const known = ctx.tasks.find((t) => t.project === project && same(t.title, name));
  if (known) return known.title;
  // A ticket is its own work item: the model often splits "DS-1 Login bug" into project DS-1 + task "Login bug"
  const key = ticketKeyOf(project);
  if (key && [project, key, ticketSummaryOf(project)].some((s) => s && same(s, name))) return undefined;
  return name;
}

/** `restOfDay` without a duration in the result means there was nothing left to fill, or no target. */
export function resolveExtractedLogs(logs: ExtractedLog[], ctx: ResolveLogsContext): ChatLog[] {
  const snapped = logs.map((log) => {
    const project = snapProject(log.project, ctx.projects);
    const task = snapTask(log.task, project, ctx);
    // The model sometimes repeats the title as the description; that says nothing the card doesn't
    const description = log.description?.trim();
    const repeatsTitle = [project, task, ticketSummaryOf(project)].some((s) => s && description && same(s, description));
    // Typos land here too ("DS-4565"), so the card points them out before Save creates them
    const newProject = !ctx.projects.includes(project);
    return {
      ...log,
      project,
      task,
      description: description && !repeatsTitle ? description : undefined,
      ...resolveCategory(log, project, newProject, ctx),
      newProject,
      newTask: !!task && !ctx.tasks.some((t) => t.project === project && t.title === task),
    };
  });

  return snapped.map((log, i) => {
    if (!log.restOfDay) return log;
    if (!ctx.targetMinutes) return { ...log, duration: undefined };
    const others = snapped.reduce(
      (sum, other, j) => (j !== i && other.date === log.date && !other.restOfDay ? sum + (other.duration ?? 0) : sum),
      0,
    );
    const rest = ctx.targetMinutes - ctx.loggedMinutesOn(log.date) - others;
    return { ...log, duration: rest > 0 ? rest : undefined };
  });
}

/** A "rest of the day" entry with nothing to fill can't be saved: it would turn into a plan. */
export const isUnresolvedRest = (log: ExtractedLog) => !!log.restOfDay && log.duration == null;
